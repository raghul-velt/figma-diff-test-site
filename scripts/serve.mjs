#!/usr/bin/env node
// A tiny static server for public/, with the same clean-URL routing as the Vercel deployment:
// `/pricing` serves `pricing.html`, `/clean/m` serves `clean/m.html`, `/` serves `index.html`.
//
//   node scripts/serve.mjs [port]      (default 4321)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

async function isFile(path) {
	try { return (await stat(path)).isFile(); } catch { return false; }
}

async function resolve(urlPath) {
	const clean = normalize(decodeURIComponent(urlPath.split('?')[0].split('#')[0])).replace(/^(\.\.[/\\])+/, '');
	const base = join(root, clean);
	if (!base.startsWith(root)) return null;
	const candidates = clean === '/' ? [join(root, 'index.html')] : [base, `${base.replace(/\/$/, '')}.html`, join(base, 'index.html')];
	for (const candidate of candidates) if (await isFile(candidate)) return candidate;
	return null;
}

/** Starts the server; resolves with `{ url, close }`. Port 0 picks a free port. */
export function startServer({ port = 4321 } = {}) {
	const server = createServer(async (request, response) => {
		try {
			const file = await resolve(request.url || '/');
			if (!file) { response.writeHead(404, { 'content-type': 'text/plain' }); response.end('Not found'); return; }
			response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
			response.end(await readFile(file));
		} catch (error) {
			response.writeHead(500, { 'content-type': 'text/plain' });
			response.end(String(error));
		}
	});
	return new Promise((resolvePromise) => {
		server.listen(port, '127.0.0.1', () => {
			const { port: actual } = server.address();
			resolvePromise({ url: `http://127.0.0.1:${actual}`, close: () => new Promise((done) => server.close(done)) });
		});
	});
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const port = Number(process.argv[2] || 4321);
	startServer({ port }).then(({ url }) => console.log(`Serving public/ at ${url}  (buggy: /, /pricing, /m  clean: /clean, /clean/pricing, /clean/m)`));
}
