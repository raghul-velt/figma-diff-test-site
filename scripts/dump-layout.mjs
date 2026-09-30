#!/usr/bin/env node
// Renders each CLEAN page the way the Figma Comparison agent captures a page, and writes what a
// designer would need to redraw it: design-dump/<page>.json (plus a full-page screenshot in
// screenshots/clean-<page>.png). The Figma frames are generated from these files.
//
//   node scripts/dump-layout.mjs [--pages home,pricing,mobile] [--base http://127.0.0.1:4321] [--no-screenshots]
//
// Elements are classified with the same rules the agent's page inventory uses, so every Figma layer
// has exactly one counterpart on the page:
//   text      an element whose descendants all flow inline owns their text as ONE entry (a link
//             inside a sentence is part of the sentence); an inline-block/flex box breaks the run;
//             an element with block children contributes only its own direct text.
//   asset     <svg>, <img>, <picture>, <video>, <canvas>, or anything with a background image.
//   box       anything else that paints a background colour or a border.
//   container an element marked data-figma-autolayout (becomes a Figma auto-layout frame).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PAGES } from './build.mjs';
import { ROOT, FREEZE_MOTION_CSS, captureContextOptions, loadPlaywright } from './lib/env.mjs';
import { startServer } from './serve.mjs';

const FRAME_WIDTH = { home: 1440, pricing: 1440, mobile: 375 };

function parseArgs(argv) {
	const args = { pages: ['home', 'pricing', 'mobile'], base: null, screenshots: true };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--pages') args.pages = argv[++i].split(',');
		else if (argv[i] === '--base') args.base = argv[++i].replace(/\/$/, '');
		else if (argv[i] === '--no-screenshots') args.screenshots = false;
	}
	return args;
}

/** Runs in the page. Returns the classified inventory plus everything needed to redraw it. */
function collect() {
	const NON_TEXT = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1, IFRAME: 1, OBJECT: 1, SVG: 1, VIDEO: 1, AUDIO: 1, CANVAS: 1 };
	const INLINE_TAGS = { A: 1, ABBR: 1, B: 1, BDI: 1, BDO: 1, BR: 1, CITE: 1, CODE: 1, DATA: 1, DFN: 1, EM: 1, I: 1, KBD: 1, LABEL: 1, MARK: 1, Q: 1, S: 1, SAMP: 1, SMALL: 1, SPAN: 1, STRONG: 1, SUB: 1, SUP: 1, TIME: 1, U: 1, VAR: 1, WBR: 1, DEL: 1, INS: 1, FONT: 1 };
	const ASSET_TAGS = { IMG: 1, PICTURE: 1, SVG: 1, VIDEO: 1, CANVAS: 1 };
	const TRANSPARENT = { 'rgba(0, 0, 0, 0)': 1, transparent: 1 };
	const warnings = [];
	const tagOf = (el) => (el.tagName || '').toUpperCase();

	const canvas = document.createElement('canvas');
	canvas.width = 1; canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	/** Any CSS colour (rgb(), oklch(), ...) as sRGB hex + alpha, via the browser's own conversion. */
	function colour(css) {
		if (!css || TRANSPARENT[css]) return null;
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = '#000000';
		ctx.fillStyle = css;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
		if (a === 0) return null;
		const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
		return a === 255 ? { hex } : { hex, alpha: Math.round((a / 255) * 1000) / 1000 };
	}
	const px = (value) => { const n = parseFloat(value); return Number.isFinite(n) ? n : 0; };
	const r2 = (n) => Math.round(n * 100) / 100;
	const boxOf = (rect) => ({ x: r2(rect.left + window.scrollX), y: r2(rect.top + window.scrollY), w: r2(rect.width), h: r2(rect.height) });

	function isVisible(el, style, rect) {
		if (style.display === 'none' || style.visibility === 'hidden') return false;
		if (Number(style.opacity) === 0) return false;
		return rect.width > 0 && rect.height > 0;
	}
	function isHiddenText(el, style) {
		if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
		if (Number(style.opacity) === 0) return true;
		if (style.position === 'absolute' || style.position === 'fixed') {
			const rect = el.getBoundingClientRect();
			if (rect.width <= 1 || rect.height <= 1) return true;
		}
		return false;
	}
	function isInlineLevel(el, style) {
		const tag = tagOf(el);
		if (tag === 'BR' || tag === 'WBR') return true;
		const display = (style.display || '').toLowerCase();
		if (!display || display === 'contents') return !!INLINE_TAGS[tag];
		return display === 'inline' || display === 'inline flow';
	}
	function hasOnlyInlineContent(el) {
		for (const child of el.children) {
			if (NON_TEXT[tagOf(child)]) continue;
			const childStyle = getComputedStyle(child);
			if (childStyle.display === 'none') continue;
			if (!isInlineLevel(child, childStyle)) return false;
			if (!hasOnlyInlineContent(child)) return false;
		}
		return true;
	}
	function applyTransform(text, transform) {
		switch ((transform || '').toLowerCase()) {
			case 'uppercase': return text.toUpperCase();
			case 'lowercase': return text.toLowerCase();
			case 'capitalize': return text.replace(/(^|\s)([^\s\p{L}\p{N}]*)(\p{L})/gu, (_m, s, lead, letter) => s + lead + letter.toUpperCase());
			default: return text;
		}
	}
	function paints(style) {
		const bg = style.backgroundColor || '';
		const hasBg = !!bg && !TRANSPARENT[bg];
		const hasImage = !!style.backgroundImage && style.backgroundImage !== 'none';
		const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((side) => px(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none');
		return hasBg || hasImage || hasBorder;
	}
	const familyOf = (style) => (style.fontFamily.split(',')[0] || '').replace(/["']/g, '').trim();
	const lineHeightOf = (style) => (style.lineHeight === 'normal' ? null : px(style.lineHeight));
	const letterSpacingOf = (style) => (style.letterSpacing === 'normal' ? 0 : px(style.letterSpacing));
	const runStyle = (style) => ({
		family: familyOf(style), weight: Number(style.fontWeight) || 400, italic: style.fontStyle === 'italic',
		size: px(style.fontSize), lineHeight: lineHeightOf(style), letterSpacing: letterSpacingOf(style),
		color: (colour(style.color) || { hex: '#000000' }).hex,
		underline: (style.textDecorationLine || '').includes('underline'),
	});

	/**
	 * The element's text as it sits in the DOM (whitespace collapsed, no text-transform), with the
	 * style of every run, the rendered line count and the width the text actually occupies.
	 */
	function textDetails(el, ownerOfRun) {
		const chars = [];
		const styles = [];
		const walk = (node) => {
			const style = getComputedStyle(node);
			const key = JSON.stringify(runStyle(style));
			for (const child of node.childNodes) {
				if (child.nodeType === 3) {
					for (const ch of child.nodeValue || '') { chars.push(ch); styles.push(key); }
				} else if (child.nodeType === 1 && ownerOfRun) {
					const tag = tagOf(child);
					if (tag === 'BR') { chars.push(' '); styles.push(key); continue; }
					if (NON_TEXT[tag] || isHiddenText(child, getComputedStyle(child))) continue;
					walk(child);
				}
			}
		};
		walk(el);
		let raw = '';
		const rawStyles = [];
		for (let i = 0; i < chars.length; i++) {
			const ws = /\s/.test(chars[i]);
			if (ws) { if (raw.length === 0 || raw.endsWith(' ')) continue; raw += ' '; rawStyles.push(styles[i]); continue; }
			raw += chars[i]; rawStyles.push(styles[i]);
		}
		while (raw.endsWith(' ')) { raw = raw.slice(0, -1); rawStyles.pop(); }
		const runs = [];
		for (let i = 0; i < rawStyles.length; i++) {
			const last = runs[runs.length - 1];
			if (last && last.key === rawStyles[i]) last.end = i + 1; else runs.push({ key: rawStyles[i], start: i, end: i + 1 });
		}
		const range = document.createRange();
		range.selectNodeContents(el);
		const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0).sort((a, b) => a.top - b.top);
		const lines = [];
		for (const rect of rects) {
			const middle = (rect.top + rect.bottom) / 2;
			const line = lines.find((l) => middle >= l.top && middle <= l.bottom);
			if (line) { line.top = Math.min(line.top, rect.top); line.bottom = Math.max(line.bottom, rect.bottom); } else lines.push({ top: rect.top, bottom: rect.bottom });
		}
		const left = Math.min(...rects.map((rect) => rect.left));
		const right = Math.max(...rects.map((rect) => rect.right));
		return {
			raw,
			runs: runs.length > 1 ? runs.map((run) => ({ start: run.start, end: run.end, ...JSON.parse(run.key) })) : null,
			lines: Math.max(1, lines.length),
			textWidth: rects.length ? r2(right - left) : 0,
		};
	}

	/** Horizontal alignment implied by a flex parent that centres the element (buttons, badges). */
	function alignHint(el) {
		const parent = el.parentElement;
		if (!parent) return null;
		const ps = getComputedStyle(parent);
		if (!/flex/.test(ps.display)) return null;
		const column = (ps.flexDirection || '').startsWith('column');
		const centred = column ? ps.alignItems === 'center' : ps.justifyContent === 'center';
		return centred ? 'center' : null;
	}

	function svgMarkup(el) {
		const clone = el.cloneNode(true);
		const scrub = (node) => {
			for (const attr of [...node.attributes]) {
				if (/^(class|style|role|aria-.*|data-.*|focusable|tabindex)$/.test(attr.name)) node.removeAttribute(attr.name);
			}
			for (const child of node.children) scrub(child);
		};
		scrub(clone);
		const rect = el.getBoundingClientRect();
		clone.setAttribute('width', String(Math.round(rect.width)));
		clone.setAttribute('height', String(Math.round(rect.height)));
		return new XMLSerializer().serializeToString(clone).replace(/\s+xmlns:xlink="[^"]*"/, '');
	}

	const all = [...document.body.querySelectorAll('*')];
	const textOwners = new Set();
	const claimed = (el) => { for (let n = el.parentElement; n; n = n.parentElement) if (textOwners.has(n)) return true; return false; };
	const recorded = new Map();
	const elements = [];
	let seq = 0;
	const nameOf = (el, fallback) => el.getAttribute('data-figma-name') || fallback;

	for (const el of all) {
		const style = getComputedStyle(el);
		const rect = el.getBoundingClientRect();
		if (!isVisible(el, style, rect)) continue;
		const tag = tagOf(el);
		const isAsset = !!ASSET_TAGS[tag] || (!!style.backgroundImage && style.backgroundImage !== 'none');

		let own = '';
		let owner = false;
		if (!claimed(el) && !NON_TEXT[tag]) {
			if (hasOnlyInlineContent(el)) {
				const rendered = (() => {
					let out = '';
					const walk = (node) => {
						const transform = getComputedStyle(node).textTransform;
						for (const child of node.childNodes) {
							if (child.nodeType === 3) { out += applyTransform(child.nodeValue || '', transform); continue; }
							if (child.nodeType !== 1) continue;
							const t = tagOf(child);
							if (t === 'BR') { out += ' '; continue; }
							if (NON_TEXT[t] || isHiddenText(child, getComputedStyle(child))) continue;
							walk(child);
						}
					};
					walk(el);
					return out.replace(/\s+/g, ' ').trim();
				})();
				own = rendered;
				owner = own.length > 0;
				if (owner) textOwners.add(el);
			} else {
				let direct = '';
				for (const child of el.childNodes) if (child.nodeType === 3) direct += child.nodeValue || '';
				own = applyTransform(direct.replace(/\s+/g, ' ').trim(), style.textTransform);
			}
		}

		const base = { id: `e${++seq}`, name: '', tag: tag.toLowerCase(), box: boxOf(rect) };
		if (own.length > 0) {
			const details = textDetails(el, owner);
			const lh = lineHeightOf(style);
			const entry = {
				...base, kind: 'text', name: nameOf(el, `${tag.toLowerCase()} "${details.raw.slice(0, 24)}"`),
				text: details.raw, renderedText: own, textTransform: style.textTransform,
				font: { family: familyOf(style), weight: Number(style.fontWeight) || 400, italic: style.fontStyle === 'italic', size: px(style.fontSize), lineHeight: lh, letterSpacing: letterSpacingOf(style) },
				color: (colour(style.color) || { hex: '#000000' }).hex,
				textAlign: style.textAlign, alignHint: base.box.w < 200 ? alignHint(el) : null,
				decoration: (style.textDecorationLine || '').includes('underline') ? 'underline' : null,
				lines: details.lines, textWidth: details.textWidth,
				...(details.runs ? { runs: details.runs } : {}),
			};
			if (!owner) warnings.push(`${entry.name}: text next to block children; only its direct text is compared`);
			if (lh && Math.abs(base.box.h - details.lines * lh) > 1.5) warnings.push(`${entry.name}: box height ${base.box.h} is not ${details.lines} x ${lh} (padding or a fixed height on a text element?)`);
			if (!el.hasAttribute('data-figma-name')) warnings.push(`${entry.name}: no data-figma-name`);
			elements.push(entry); recorded.set(el, entry);
			continue;
		}
		if (isAsset) {
			const entry = { ...base, kind: 'asset', name: nameOf(el, `${tag.toLowerCase()} asset`), ...(tag === 'SVG' ? { svg: svgMarkup(el) } : { src: el.currentSrc || el.src || style.backgroundImage }) };
			if (!el.hasAttribute('data-figma-name')) warnings.push(`${entry.name}: no data-figma-name`);
			elements.push(entry); recorded.set(el, entry);
			continue;
		}
		if (paints(style)) {
			const border = {};
			for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
				const width = style[`border${side}Style`] === 'none' ? 0 : px(style[`border${side}Width`]);
				if (width > 0) border[side.toLowerCase()] = { width, color: (colour(style[`border${side}Color`]) || { hex: '#000000' }).hex };
			}
			const radius = (corner) => { const value = style[`border${corner}Radius`] || '0'; return value.endsWith('%') ? (parseFloat(value) / 100) * Math.min(rect.width, rect.height) : px(value); };
			const radii = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(radius);
			const fill = colour(style.backgroundColor);
			const entry = {
				...base, kind: 'box', name: nameOf(el, `${tag.toLowerCase()} box`),
				...(fill ? { background: fill.hex, ...(fill.alpha !== undefined ? { backgroundAlpha: fill.alpha } : {}) } : {}),
				radius: radii.every((value) => value === radii[0]) ? radii[0] : radii,
				...(Object.keys(border).length ? { border } : {}),
				clips: style.overflow !== 'visible',
			};
			if (!el.hasAttribute('data-figma-name')) warnings.push(`${entry.name}: no data-figma-name`);
			elements.push(entry); recorded.set(el, entry);
		}
		if (el.hasAttribute('data-figma-autolayout')) {
			const direction = el.getAttribute('data-figma-autolayout') === 'vertical' ? 'vertical' : 'horizontal';
			const computedColumn = (style.flexDirection || '').startsWith('column');
			if ((direction === 'vertical') !== computedColumn) warnings.push(`${nameOf(el, 'container')}: data-figma-autolayout="${direction}" but flex-direction is ${style.flexDirection}`);
			const entry = {
				...base, kind: 'container', name: nameOf(el, 'auto layout'), direction,
				gap: px(direction === 'vertical' ? style.rowGap : style.columnGap),
				alignItems: style.alignItems, justifyContent: style.justifyContent, childEls: [...el.children],
			};
			if (recorded.has(el)) warnings.push(`${entry.name}: a painted auto-layout container is not supported; paint a wrapper instead`);
			elements.push(entry); recorded.set(el, entry);
		}
	}

	// Parents: the nearest recorded box or container above each element.
	const byEl = recorded;
	for (const [el, entry] of byEl) {
		let parent = 'root';
		for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
			const candidate = byEl.get(n);
			if (candidate && (candidate.kind === 'box' || candidate.kind === 'container')) { parent = candidate.id; break; }
		}
		entry.parent = parent;
	}
	for (const entry of elements) {
		if (entry.kind !== 'container') continue;
		entry.children = entry.childEls.map((child) => byEl.get(child)).filter(Boolean).map((child) => child.id);
		if (entry.children.length !== entry.childEls.length) warnings.push(`${entry.name}: ${entry.childEls.length - entry.children.length} DOM child(ren) are not drawn elements; auto layout may misplace them`);
		// The measured gap between neighbours, for the record.
		const kids = entry.children.map((id) => elements.find((e) => e.id === id));
		const gaps = [];
		for (let i = 1; i < kids.length; i++) {
			gaps.push(entry.direction === 'vertical' ? r2(kids[i].box.y - (kids[i - 1].box.y + kids[i - 1].box.h)) : r2(kids[i].box.x - (kids[i - 1].box.x + kids[i - 1].box.w)));
		}
		entry.measuredGaps = gaps;
		delete entry.childEls;
	}

	const fonts = new Map();
	for (const entry of elements) {
		if (entry.kind !== 'text') continue;
		for (const run of [entry.font, ...(entry.runs || [])]) fonts.set(`${run.family}|${run.weight}|${run.italic}`, { family: run.family, weight: run.weight, italic: !!run.italic });
	}
	return {
		document: { width: document.documentElement.clientWidth, height: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth },
		fonts: [...fonts.values()],
		elements,
		warnings,
	};
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const { chromium } = await loadPlaywright();
	const server = args.base ? null : await startServer({ port: 0 });
	const base = args.base || server.url;
	const browser = await chromium.launch();
	await mkdir(join(ROOT, 'design-dump'), { recursive: true });
	await mkdir(join(ROOT, 'screenshots'), { recursive: true });
	try {
		for (const pageName of args.pages) {
			const spec = PAGES.find((entry) => entry.page === pageName);
			const width = FRAME_WIDTH[pageName];
			const context = await browser.newContext(captureContextOptions(width));
			const page = await context.newPage();
			await page.goto(base + spec.cleanPath, { waitUntil: 'networkidle' });
			await page.addStyleTag({ content: FREEZE_MOTION_CSS });
			// Scroll-revealed sections are drawn revealed (the agent's capture pins them the same way).
			await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible')));
			await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
			const result = await page.evaluate(collect);
			if (result.document.scrollWidth > width) result.warnings.push(`page is ${result.document.scrollWidth}px wide at a ${width}px viewport (horizontal overflow)`);
			delete result.document.scrollWidth;
			const dump = {
				page: pageName, frame: spec.frame, path: spec.cleanPath, buggyPath: spec.buggyPath,
				viewport: { width, height: 900, mobile: width < 768 },
				...result,
			};
			await writeFile(join(ROOT, 'design-dump', `${pageName}.json`), `${JSON.stringify(dump, null, '\t')}\n`);
			if (args.screenshots) await page.screenshot({ path: join(ROOT, 'screenshots', `clean-${pageName}.png`), fullPage: true });
			const counts = dump.elements.reduce((acc, e) => { acc[e.kind] = (acc[e.kind] || 0) + 1; return acc; }, {});
			console.log(`${pageName.padEnd(8)} ${spec.cleanPath.padEnd(15)} ${width}x${dump.document.height}  ${JSON.stringify(counts)}  fonts: ${dump.fonts.map((f) => `${f.family} ${f.weight}${f.italic ? 'i' : ''}`).join(', ')}`);
			for (const warning of dump.warnings) console.log(`  warning: ${warning}`);
			await context.close();
		}
	} finally {
		await browser.close();
		if (server) await server.close();
	}
}

main().catch((error) => { console.error(error); process.exit(1); });
