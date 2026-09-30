#!/usr/bin/env node
// Turns design-dump/<page>.json into figma/scripts/<page>.js: one self-contained script per frame for
// the Figma plugin API (run it with the `use_figma` tool, or paste it into any plugin runner that
// supports top-level await). Each script deletes an existing top-level frame of the same name on the
// current page, then builds the frame from the dump.
//
//   node scripts/figma/generate-scripts.mjs [--cleanup <nodeId,...>]
//
// Dynamic strings are swapped for their design values here (DESIGN_TEXT_OVERRIDES), so the frames
// show a different time and price from the page, which the agent must ignore.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../lib/env.mjs';
import { DESIGN_TEXT_OVERRIDES } from '../../src/content.mjs';

/** Frames are laid out left to right with a 200px gap; the (control) duplicates follow. */
export const FRAME_LAYOUT = [
	{ page: 'home', name: 'Home', x: 0 },
	{ page: 'pricing', name: 'Pricing', x: 1640 },
	{ page: 'mobile', name: 'Home Mobile', x: 3280 },
];
export const MAX_SCRIPT_BYTES = 50_000;

const STYLE_NAMES = {
	Inter: { 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold' },
	'Playfair Display': { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' },
};
export function figmaStyle(family, weight, italic) {
	const names = STYLE_NAMES[family];
	if (!names || !names[weight]) throw new Error(`No Figma style mapping for ${family} ${weight}`);
	const base = names[weight];
	if (!italic) return base;
	return base === 'Regular' ? 'Italic' : `${base} Italic`;
}

const ALIGN = { left: 'LEFT', start: 'LEFT', center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' };
const CASE = { uppercase: 'UPPER', lowercase: 'LOWER', capitalize: 'TITLE' };
const round2 = (n) => Math.round(n * 100) / 100;
const boxArray = (box) => [round2(box.x), round2(box.y), round2(box.w), round2(box.h)];

/** A text element is drawn hug-width when it is one line and its box is tight around the words. */
export const isHugText = (e) => e.lines === 1 && e.box.w - e.textWidth < 24;

export function buildData(dump, layout, { cleanup = [] } = {}) {
	const fonts = new Map();
	const svgs = new Map();
	const idMap = new Map([['root', 0]]);
	const els = [];
	const addFont = (family, style) => fonts.set(`${family}|${style}`, [family, style]);

	for (const e of dump.elements) {
		idMap.set(e.id, e.id);
		const base = { k: e.kind[0], i: e.id, p: idMap.get(e.parent) ?? 0, n: e.name };
		if (e.kind === 'text') {
			const style = figmaStyle(e.font.family, e.font.weight, e.font.italic);
			addFont(e.font.family, style);
			const text = DESIGN_TEXT_OVERRIDES[e.text] ?? e.text;
			if (text.length !== e.text.length && e.runs) throw new Error(`Override for "${e.text}" changes its length and it has runs`);
			const runs = (e.runs || []).map((run) => {
				const out = {};
				if (run.family !== e.font.family || run.weight !== e.font.weight || run.italic !== e.font.italic) {
					const runStyle = figmaStyle(run.family, run.weight, run.italic);
					addFont(run.family, runStyle);
					out.f = [run.family, runStyle];
				}
				if (run.size !== e.font.size) out.fs = run.size;
				if (run.lineHeight !== e.font.lineHeight && run.lineHeight) out.lh = run.lineHeight;
				if (run.letterSpacing !== e.font.letterSpacing) out.ls = run.letterSpacing;
				if (run.color !== e.color) out.c = run.color;
				if (run.underline !== (e.decoration === 'underline')) out.u = run.underline;
				return Object.keys(out).length ? [run.start, run.end, out] : null;
			}).filter(Boolean);
			els.push({
				...base, b: boxArray(e.box), s: text, f: [e.font.family, style], fs: e.font.size, lh: e.font.lineHeight, ls: e.font.letterSpacing,
				...(CASE[e.textTransform] ? { tc: CASE[e.textTransform] } : {}),
				al: ALIGN[e.alignHint || e.textAlign] || 'LEFT', c: e.color, ...(e.decoration === 'underline' ? { u: 1 } : {}),
				ln: e.lines, ...(isHugText(e) ? { hug: 1 } : {}),
				...(runs.length ? { runs } : {}), ...((e.runs || []).some((run) => run.size !== e.font.size) ? { mix: 1 } : {}),
			});
		} else if (e.kind === 'box') {
			const border = e.border ? ['top', 'right', 'bottom', 'left'].map((side) => e.border[side]?.width || 0) : null;
			const borderColor = e.border ? Object.values(e.border)[0].color : null;
			els.push({
				...base, b: boxArray(e.box), ...(e.background ? { bg: e.background } : {}), ...(e.backgroundAlpha !== undefined ? { bga: e.backgroundAlpha } : {}),
				r: e.radius, ...(border ? { st: { c: borderColor, w: border } } : {}), ...(e.clips ? { clip: 1 } : {}),
			});
		} else if (e.kind === 'asset') {
			if (!e.svg) throw new Error(`Asset ${e.name} is not an inline SVG`);
			if (!svgs.has(e.svg)) svgs.set(e.svg, `s${svgs.size + 1}`);
			els.push({ ...base, b: boxArray(e.box), svg: svgs.get(e.svg) });
		} else if (e.kind === 'container') {
			const kids = e.children.map((id) => dump.elements.find((x) => x.id === id));
			const x0 = Math.min(...kids.map((k) => k.box.x));
			const y0 = Math.min(...kids.map((k) => k.box.y));
			const x1 = Math.max(...kids.map((k) => k.box.x + k.box.w));
			const y1 = Math.max(...kids.map((k) => k.box.y + k.box.h));
			const ai = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX' }[e.alignItems] || 'MIN';
			els.push({ ...base, b: [round2(x0), round2(y0), round2(x1 - x0), round2(y1 - y0)], dir: e.direction === 'vertical' ? 'V' : 'H', gap: e.gap, ai });
		}
	}
	return {
		name: layout.name, w: dump.viewport.width, h: Math.round(dump.document.height), x: layout.x, y: 0,
		cleanup, fonts: [...fonts.values()], svgs: Object.fromEntries([...svgs].map(([markup, key]) => [key, markup])), els,
	};
}

async function main() {
	const argv = process.argv.slice(2);
	const cleanupIndex = argv.indexOf('--cleanup');
	const cleanup = cleanupIndex >= 0 ? argv[cleanupIndex + 1].split(',') : [];
	const runtime = await readFile(join(ROOT, 'scripts', 'figma', 'builder.js'), 'utf8');
	await mkdir(join(ROOT, 'figma', 'scripts'), { recursive: true });
	for (const [index, layout] of FRAME_LAYOUT.entries()) {
		const dump = JSON.parse(await readFile(join(ROOT, 'design-dump', `${layout.page}.json`), 'utf8'));
		const data = buildData(dump, layout, { cleanup: index === 0 ? cleanup : [] });
		const script = `// Generated by scripts/figma/generate-scripts.mjs from design-dump/${layout.page}.json. Do not edit.\nconst D = ${JSON.stringify(data)};\n${runtime}`;
		const bytes = Buffer.byteLength(script);
		if (bytes > MAX_SCRIPT_BYTES) throw new Error(`figma/scripts/${layout.page}.js is ${bytes} bytes (limit ${MAX_SCRIPT_BYTES})`);
		await writeFile(join(ROOT, 'figma', 'scripts', `${layout.page}.js`), script);
		console.log(`figma/scripts/${layout.page}.js  ${bytes} bytes  frame "${layout.name}" ${data.w}x${data.h} at x=${layout.x}  elements=${data.els.length} svgs=${Object.keys(data.svgs).length} fonts=${data.fonts.map((f) => f.join(' ')).join(', ')}`);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exit(1); });
