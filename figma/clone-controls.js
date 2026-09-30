// Run with the Figma plugin API after the three frames are built: clones each frame into a
// "(control)" duplicate in the same row, replacing any earlier controls. Set the three source ids.
const SOURCES = { Home: '4:2', Pricing: '6:2', 'Home Mobile': '7:2' };
const X = { Home: 3855, Pricing: 5495, 'Home Mobile': 7135 };
const page = figma.currentPage;
for (const node of page.children.filter((n) => n.name.endsWith(' (control)'))) node.remove();
const created = [];
for (const [name, id] of Object.entries(SOURCES)) {
	const source = await figma.getNodeByIdAsync(id);
	if (!source) throw new Error(`Frame ${name} (${id}) not found`);
	const copy = source.clone();
	copy.name = `${name} (control)`;
	copy.x = X[name];
	copy.y = 0;
	created.push({ id: copy.id, name: copy.name });
}
return { created };
