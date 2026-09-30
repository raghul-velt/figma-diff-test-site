#!/usr/bin/env node
// Builds public/ from src/: three pages, each in a BUGGY variant (the paths the agent reports on)
// and a CLEAN variant (the reference implementation the Figma frames were generated from).
//
//   /            buggy Home          /clean            clean Home
//   /pricing     buggy Pricing       /clean/pricing    clean Pricing
//   /m           buggy Home Mobile   /clean/m          clean Home Mobile

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage } from '../src/templates.mjs';
import { BUGS, bugsFor } from '../src/bugs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

export const PAGES = [
	{ page: 'home', frame: 'Home', buggyPath: '/', cleanPath: '/clean', buggyFile: 'index.html', cleanFile: 'clean.html' },
	{ page: 'pricing', frame: 'Pricing', buggyPath: '/pricing', cleanPath: '/clean/pricing', buggyFile: 'pricing.html', cleanFile: 'clean/pricing.html' },
	{ page: 'mobile', frame: 'Home Mobile', buggyPath: '/m', cleanPath: '/clean/m', buggyFile: 'm.html', cleanFile: 'clean/m.html' },
];

async function main() {
	await rm(out, { recursive: true, force: true });
	await mkdir(join(out, 'clean'), { recursive: true });
	await writeFile(join(out, 'styles.css'), await readFile(join(root, 'src', 'styles.css')));

	const links = {
		buggy: { home: '/', pricing: '/pricing', mobileHome: '/m' },
		clean: { home: '/clean', pricing: '/clean/pricing', mobileHome: '/clean/m' },
	};

	for (const spec of PAGES) {
		for (const variant of ['clean', 'buggy']) {
			const bugs = new Set(variant === 'buggy' ? bugsFor(spec.page) : []);
			const pageLinks = { ...links[variant], home: spec.page === 'mobile' ? links[variant].mobileHome : links[variant].home };
			const html = renderPage(spec.page, { bugs, links: pageLinks, variant });
			const file = variant === 'buggy' ? spec.buggyFile : spec.cleanFile;
			await mkdir(dirname(join(out, file)), { recursive: true });
			await writeFile(join(out, file), html);
			const path = variant === 'buggy' ? spec.buggyPath : spec.cleanPath;
			console.log(`${path.padEnd(16)} -> public/${file.padEnd(20)} ${variant === 'buggy' ? `seeded: ${[...bugs].join(', ')}` : 'reference'}`);
		}
	}

	// A plain index of the variants, for people opening the deployment in a browser.
	const rows = PAGES.map((spec) => `<tr><td>${spec.frame}</td><td><a href="${spec.buggyPath}">${spec.buggyPath}</a></td><td><a href="${spec.cleanPath}">${spec.cleanPath}</a></td><td>${bugsFor(spec.page).map((id) => `${id}: ${BUGS[id].summary}`).join('<br>')}</td></tr>`).join('\n');
	await writeFile(join(out, 'variants.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Orbit test site variants</title>
<style>body{font:14px/20px system-ui,sans-serif;margin:32px;color:#111827}table{border-collapse:collapse}td,th{border:1px solid #E5E7EB;padding:8px 12px;text-align:left;vertical-align:top}</style></head>
<body><h1>Orbit test site: variants</h1><p>Buggy paths carry the seeded differences; clean paths are the reference the Figma frames were generated from.</p>
<table><tr><th>Frame</th><th>Buggy</th><th>Clean</th><th>Seeded differences</th></tr>
${rows}
</table></body></html>
`);
	console.log('/variants        -> public/variants.html (index of the variants)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => { console.error(error); process.exit(1); });
}
