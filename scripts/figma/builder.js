// Figma frame builder. Runs inside the Figma plugin API (the `use_figma` tool); the generator
// prepends `const D = {...}` (one page's layout data) and this file builds one top-level frame.
//
// Mapping (the same one the dump uses, so every layer has one page counterpart):
//   text      -> TEXT, raw DOM text + textCase for text-transform, exact font/size/line height/
//                letter spacing/colour; fixed width + auto height, or hug width for a tight
//                single line; rich-text runs become range styles (a mixed-style node).
//   box       -> FRAME with the same fill, radius and (individual) strokes.
//   asset     -> createNodeFromSvg, strokes outlined, then flattened into ONE vector named after
//                the element, inside a fill-less wrapper frame of exactly the <svg> box.
//   container -> a real auto-layout frame (itemSpacing = measured gap) holding its children.
// Coordinates come from the page's document box, so the frame is the clean page, laid out.

const page = figma.currentPage;
const result = { frameName: D.name, rootId: null, nodes: {}, textFits: [], removed: [] };

for (const id of D.cleanup || []) {
	const stale = await figma.getNodeByIdAsync(id);
	if (stale) { stale.remove(); result.removed.push(id); }
}
for (const node of page.children.filter((n) => n.name === D.name)) { result.removed.push(node.id); node.remove(); }

await Promise.all(D.fonts.map(([family, style]) => figma.loadFontAsync({ family, style })));

const hexToRgb = (hex) => ({ r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 });
const paint = (hex, opacity) => (opacity !== undefined && opacity < 1 ? { type: 'SOLID', color: hexToRgb(hex), opacity } : { type: 'SOLID', color: hexToRgb(hex) });

const root = figma.createFrame();
root.name = D.name;
root.resize(D.w, D.h);
root.x = D.x;
root.y = D.y;
root.fills = [paint('#FFFFFF')];
root.clipsContent = true;
page.appendChild(root);
result.rootId = root.id;

const nodes = { 0: root };
const origin = { 0: { x: 0, y: 0 } };
const kinds = { 0: 'root' };

function place(node, e, x) {
	const parentOrigin = origin[e.p];
	node.x = x - parentOrigin.x;
	node.y = e.b[1] - parentOrigin.y;
}

function makeText(e) {
	const t = figma.createText();
	t.name = e.n;
	t.fontName = { family: e.f[0], style: e.f[1] };
	t.characters = e.s;
	t.fontSize = e.fs;
	t.lineHeight = { unit: 'PIXELS', value: e.lh };
	t.letterSpacing = { unit: 'PIXELS', value: e.ls };
	if (e.tc) t.textCase = e.tc;
	t.textAlignHorizontal = e.al;
	t.fills = [paint(e.c)];
	if (e.u) t.textDecoration = 'UNDERLINE';
	for (const [start, end, run] of e.runs || []) {
		if (run.f) t.setRangeFontName(start, end, { family: run.f[0], style: run.f[1] });
		if (run.fs) t.setRangeFontSize(start, end, run.fs);
		if (run.lh) t.setRangeLineHeight(start, end, { unit: 'PIXELS', value: run.lh });
		if (run.ls !== undefined) t.setRangeLetterSpacing(start, end, { unit: 'PIXELS', value: run.ls });
		if (run.c) t.setRangeFills(start, end, [paint(run.c)]);
		if (run.u !== undefined) t.setRangeTextDecoration(start, end, run.u ? 'UNDERLINE' : 'NONE');
	}
	return t;
}

function anchorX(e, width) {
	const [x, , w] = e.b;
	if (e.al === 'CENTER') return x + w / 2 - width / 2;
	if (e.al === 'RIGHT') return x + w - width;
	return x;
}

for (const e of D.els) {
	const parent = nodes[e.p];
	if (!parent) throw new Error(`parent ${e.p} of ${e.i} (${e.n}) was not built`);
	const inAutoLayout = kinds[e.p] === 'container';
	const [bx, by, bw, bh] = e.b;

	if (e.k === 't') {
		const t = makeText(e);
		parent.appendChild(t);
		if (inAutoLayout || e.hug) {
			t.textAutoResize = 'WIDTH_AND_HEIGHT';
			if (!inAutoLayout) place(t, e, anchorX(e, t.width));
		} else {
			t.textAutoResize = 'HEIGHT';
			let width = bw;
			const fit = () => { t.resize(Math.max(1, width), Math.max(1, t.height)); t.textAutoResize = 'HEIGHT'; return Math.round(t.height / e.lh); };
			let lines = fit();
			let steps = 0;
			if (!e.mix) {
				while (lines > e.ln && steps < 12) { width += 2; lines = fit(); steps++; }
				while (lines < e.ln && steps < 24) { width -= 2; lines = fit(); steps++; }
			}
			if (width !== bw || lines !== e.ln) result.textFits.push({ name: e.n, lines: e.ln, figmaLines: lines, widthDelta: width - bw });
			place(t, e, anchorX(e, width));
		}
		nodes[e.i] = t;
	} else if (e.k === 'b') {
		const f = figma.createFrame();
		f.name = e.n;
		parent.appendChild(f);
		f.resize(Math.max(0.01, bw), Math.max(0.01, bh));
		if (!inAutoLayout) place(f, e, bx);
		f.fills = e.bg ? [paint(e.bg, e.bga)] : [];
		f.clipsContent = !!e.clip;
		if (Array.isArray(e.r)) { [f.topLeftRadius, f.topRightRadius, f.bottomRightRadius, f.bottomLeftRadius] = e.r; } else if (e.r) f.cornerRadius = e.r;
		if (e.st) {
			f.strokes = [paint(e.st.c)];
			f.strokeAlign = 'INSIDE';
			const [top, right, bottom, left] = e.st.w;
			if (top === right && right === bottom && bottom === left) f.strokeWeight = top;
			else { f.strokeTopWeight = top; f.strokeRightWeight = right; f.strokeBottomWeight = bottom; f.strokeLeftWeight = left; }
		}
		nodes[e.i] = f;
		origin[e.i] = { x: bx, y: by };
	} else if (e.k === 'a') {
		const svg = figma.createNodeFromSvg(D.svgs[e.svg]);
		svg.name = `${e.n} (svg)`;
		parent.appendChild(svg);
		for (const child of svg.children.slice()) {
			if (!('strokes' in child) || child.strokes.length === 0 || !(child.strokeWeight > 0)) continue;
			const index = svg.children.indexOf(child);
			const outline = child.outlineStroke();
			if (outline) { const ox = outline.x; const oy = outline.y; svg.insertChild(index + 1, outline); outline.x = ox; outline.y = oy; }
			const hasFill = child.fills !== figma.mixed && child.fills.some((p) => p.visible !== false);
			if (hasFill) child.strokes = []; else child.remove();
		}
		const vector = svg.children.length > 1 ? figma.flatten(svg.children.slice(), svg) : svg.children[0];
		vector.name = e.n;
		svg.fills = [];
		if (Math.abs(svg.width - bw) > 0.5 || Math.abs(svg.height - bh) > 0.5) svg.resize(bw, bh);
		if (!inAutoLayout) place(svg, e, bx);
		nodes[e.i] = svg;
		result.nodes[`${e.i}:vector`] = vector.id;
	} else if (e.k === 'c') {
		const c = figma.createFrame();
		c.name = e.n;
		parent.appendChild(c);
		c.layoutMode = e.dir === 'V' ? 'VERTICAL' : 'HORIZONTAL';
		c.itemSpacing = e.gap;
		c.paddingLeft = 0; c.paddingRight = 0; c.paddingTop = 0; c.paddingBottom = 0;
		c.primaryAxisSizingMode = 'AUTO';
		c.counterAxisSizingMode = 'AUTO';
		c.counterAxisAlignItems = e.ai || 'MIN';
		c.fills = [];
		c.clipsContent = false;
		if (!inAutoLayout) place(c, e, bx);
		nodes[e.i] = c;
		origin[e.i] = { x: bx, y: by };
	}
	kinds[e.i] = e.k === 'c' ? 'container' : e.k;
	result.nodes[e.i] = nodes[e.i].id;
}

result.count = Object.keys(result.nodes).length;
result.bounds = { x: root.x, y: root.y, w: root.width, h: root.height };
return result;
