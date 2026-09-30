// Tiny helpers shared by the scripts: .env loading and Playwright resolution. No dependencies.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads KEY=VALUE lines from ./.env into process.env (existing variables win). */
export function loadDotEnv() {
	try {
		const text = readFileSync(join(ROOT, '.env'), 'utf8');
		for (const line of text.split(/\r?\n/)) {
			const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
			if (!match || line.trim().startsWith('#')) continue;
			const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
			if (process.env[match[1]] === undefined || process.env[match[1]] === '') process.env[match[1]] = value;
		}
	} catch {
		// No .env: environment variables only.
	}
}

/** Resolves Playwright: PLAYWRIGHT_MODULE (a path to the package) first, then a normal import. */
export async function loadPlaywright() {
	loadDotEnv();
	const override = process.env.PLAYWRIGHT_MODULE;
	if (override) return createRequire(import.meta.url)(override);
	try {
		return await import('playwright');
	} catch {
		throw new Error('Playwright was not found. Either `npm i -D playwright && npx playwright install chromium` in this folder, or set PLAYWRIGHT_MODULE=/path/to/node_modules/playwright.');
	}
}

/**
 * The capture settings the agent uses for a frame of this width: viewport as wide as the frame,
 * 900 tall, DPR 1, a phone (mobile UA, isMobile, hasTouch) below 768, reduced motion.
 */
export function captureContextOptions(frameWidth) {
	const mobile = frameWidth < 768;
	return {
		viewport: { width: frameWidth, height: 900 },
		deviceScaleFactor: 1,
		isMobile: mobile,
		hasTouch: mobile,
		reducedMotion: 'reduce',
		...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' } : {}),
	};
}

/** Transitions and animations made instant, as the agent's capture does before its reveal pass. */
export const FREEZE_MOTION_CSS = '*, *::before, *::after { transition-duration: 0s !important; transition-delay: 0s !important; animation-duration: 0s !important; animation-delay: 0s !important; scroll-behavior: auto !important; }';
