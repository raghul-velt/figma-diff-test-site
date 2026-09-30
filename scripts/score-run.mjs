#!/usr/bin/env node
// Scores one Figma Comparison run against expected-findings.json.
//
//   node scripts/score-run.mjs <execution.json>            score a saved /v2/agents/execution/get response
//   node scripts/score-run.mjs <executionId>               fetch it live (needs VELT_API_BASE, VELT_API_KEY, VELT_AUTH_TOKEN)
//   node scripts/score-run.mjs --execution <executionId>   the same, explicitly
//
// Options:
//   --wait         poll a live execution until it is no longer running (up to 15 minutes)
//   --strict       also fail on known engine gaps that were not found
//   --pages a,b    only score these paths (e.g. /,/clean)
//   --json <file>  write the score as JSON too
//   --save <file>  save the fetched response (live mode) for later re-scoring
//
// Exit code: 0 when every detectable expected finding was found on every scored buggy page and no
// clean page has a finding; 1 otherwise; 2 on bad input.
//
// A finding is matched on its evidence (metadata.figmaDiff): the engine issue key, the Figma layer the
// finding is about (designName) and, where needed, its text. Findings that match nothing in the answer
// key are reported as unexpected (the agent invented or over-reported something).

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, loadDotEnv } from './lib/env.mjs';

function parseArgs(argv) {
	const args = { file: null, execution: null, wait: false, strict: false, pages: null, json: null, save: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--execution') args.execution = argv[++i];
		else if (a === '--wait') args.wait = true;
		else if (a === '--strict') args.strict = true;
		else if (a === '--pages') args.pages = argv[++i].split(',').map(normalizePath);
		else if (a === '--json') args.json = argv[++i];
		else if (a === '--save') args.save = argv[++i];
		else if (a === '--help' || a === '-h') args.help = true;
		else if (!a.startsWith('--')) args.file = a;
	}
	// A positional argument that is not a file on disk is an execution id.
	if (args.file && !args.execution && !existsSync(args.file) && !/\.json$/i.test(args.file)) {
		args.execution = args.file;
		args.file = null;
	}
	return args;
}

/** The comparable page key: pathname only, lower-cased, no duplicate or trailing slashes (root stays "/"). */
export function normalizePath(pathOrUrl) {
	let pathname = pathOrUrl;
	try { pathname = new URL(pathOrUrl, 'https://kit.invalid').pathname; } catch { /* keep as is */ }
	pathname = decodeURIComponent(pathname).toLowerCase().replace(/\/{2,}/g, '/');
	if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '');
	return pathname || '/';
}

/** Accepts the REST response, the callable envelope, or { execution, results } / a bare results array. */
export function unwrapExecution(json) {
	const candidates = [json?.result?.data, json?.data, json];
	for (const candidate of candidates) {
		if (!candidate) continue;
		if (Array.isArray(candidate)) return { execution: null, results: candidate };
		if (Array.isArray(candidate.results)) return { execution: candidate.execution ?? null, results: candidate.results };
	}
	return null;
}

async function fetchExecution(executionId) {
	loadDotEnv();
	const base = (process.env.VELT_API_BASE || '').replace(/\/$/, '');
	const apiKey = process.env.VELT_API_KEY;
	const authToken = process.env.VELT_AUTH_TOKEN;
	if (!base || !apiKey || !authToken) throw new Error('Live mode needs VELT_API_BASE, VELT_API_KEY and VELT_AUTH_TOKEN (environment or .env).');
	const url = `${base}/v2/agents/execution/get`;
	const headers = { 'content-type': 'application/json', 'x-velt-api-key': apiKey, 'x-velt-auth-token': authToken };
	const payload = { executionId, includeResults: true };
	const attempts = [];
	for (const body of [{ data: payload }, payload]) {
		const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
		const text = await response.text();
		let json = null;
		try { json = JSON.parse(text); } catch { /* not JSON */ }
		const unwrapped = json ? unwrapExecution(json) : null;
		if (response.ok && unwrapped && (unwrapped.execution || unwrapped.results.length)) return { json, unwrapped };
		attempts.push(`${'data' in body ? 'envelope' : 'bare'} body -> HTTP ${response.status}: ${text.slice(0, 200)}`);
	}
	throw new Error(`Could not fetch execution ${executionId}:\n  ${attempts.join('\n  ')}`);
}

const evidenceOf = (finding) => finding?.metadata?.figmaDiff ?? {};
const textOf = (finding) => `${evidenceOf(finding).expected ?? ''} ${evidenceOf(finding).actual ?? ''} ${finding?.title ?? ''} ${finding?.description ?? ''}`;

/** Whether a finding satisfies a matcher from the answer key. */
export function matches(finding, matcher) {
	const evidence = evidenceOf(finding);
	const issue = evidence.issue ?? '';
	if (matcher.issues && !matcher.issues.includes(issue)) return false;
	if (matcher.designLayers && !matcher.designLayers.includes(evidence.designName)) return false;
	if (matcher.textIncludes && !textOf(finding).includes(matcher.textIncludes)) return false;
	return true;
}

/** Scores the findings of one page against its answer-key entry. */
export function scorePage(entry, result, { strict }) {
	const findings = result?.agentResult?.findings ?? result?.findings ?? [];
	const summary = result?.agentResult?.report?.extra?.figmaDiff ?? result?.agentResult?.extra?.figmaDiff ?? null;
	const page = { path: entry.path, frame: entry.frame, variant: entry.variant, compared: !!result, skipped: summary?.skipped ? summary.reason ?? 'skipped' : null, comparedFrame: summary?.designRef?.frameName ?? null, metrics: summary?.metrics ?? null, candidateCount: summary?.candidateCount ?? null, discardedFindings: summary?.discardedFindings ?? null, found: [], missed: [], knownGapsFound: [], knownGapsMissed: [], acceptable: [], knownNoise: [], unexpected: [], falsePositives: [], problems: [] };
	if (!result) return page;
	if (page.comparedFrame && page.comparedFrame !== entry.frame) page.problems.push(`compared against frame "${page.comparedFrame}", expected "${entry.frame}"`);
	if (page.skipped) page.problems.push(`page was skipped by the agent: ${page.skipped}`);

	const describe = (finding) => {
		const e = evidenceOf(finding);
		return { candidateId: e.candidateId ?? null, issue: e.issue ?? finding.issueType ?? null, designName: e.designName ?? null, severity: finding.severity ?? null, expected: e.expected ?? null, actual: e.actual ?? null, count: e.count ?? 1, title: finding.title ?? null };
	};

	if (entry.variant === 'clean') {
		page.falsePositives = findings.map(describe);
		return page;
	}

	const claimed = new Set();
	for (const expected of entry.expected) {
		const hits = findings.filter((finding) => matches(finding, expected.match));
		hits.forEach((finding) => claimed.add(finding));
		const row = { id: expected.id, summary: expected.summary, findings: hits.map(describe) };
		if (expected.detectable === false) (hits.length ? page.knownGapsFound : page.knownGapsMissed).push(row);
		else (hits.length ? page.found : page.missed).push(row);
	}
	for (const finding of findings) {
		if (claimed.has(finding)) continue;
		const acceptable = (entry.alsoAcceptable ?? []).find((rule) => matches(finding, rule.match));
		if (acceptable) { page.acceptable.push({ for: acceptable.for, ...describe(finding) }); continue; }
		const noise = (entry.knownNoise ?? []).find((rule) => matches(finding, rule.match));
		if (noise) { page.knownNoise.push({ cause: noise.cause, ...describe(finding) }); continue; }
		page.unexpected.push(describe(finding));
	}
	if (strict) page.missed.push(...page.knownGapsMissed.map((row) => ({ ...row, strict: true })));
	return page;
}

function printPage(page) {
	const header = `${page.path.padEnd(16)} ${page.variant.padEnd(6)} frame "${page.frame}"`;
	if (!page.compared) { console.log(`\n${header}\n  not in this run`); return; }
	const m = page.metrics ? Object.entries(page.metrics).map(([k, v]) => `${k.replace(/Pct$/, '')} ${v}%`).join(', ') : 'no metrics';
	console.log(`\n${header}  (${m}; candidates ${page.candidateCount ?? '?'}, discarded ${page.discardedFindings ?? '?'})`);
	for (const problem of page.problems) console.log(`  ! ${problem}`);
	const line = (mark, row) => console.log(`  ${mark} ${row.id ? `(${row.id}) ` : ''}${row.summary ?? ''}${row.findings?.length ? `  <- ${row.findings.map((f) => `${f.issue} [${f.designName}]${f.count > 1 ? ` x${f.count}` : ''}`).join('; ')}` : ''}`);
	const finding = (mark, f, extra = '') => console.log(`  ${mark} ${extra}${f.issue} [${f.designName}] ${f.severity ?? ''}: expected ${JSON.stringify(f.expected)} actual ${JSON.stringify(f.actual)}`);
	if (page.variant === 'clean') {
		if (!page.falsePositives.length) console.log('  ok  no findings (as expected for a clean page)');
		page.falsePositives.forEach((f) => finding('FP ', f, 'false positive: '));
		return;
	}
	page.found.forEach((row) => line('ok ', row));
	page.missed.forEach((row) => line('MISS', row));
	page.knownGapsFound.forEach((row) => line('ok+', { ...row, summary: `${row.summary} (known engine gap, but found)` }));
	page.knownGapsMissed.forEach((row) => line('gap', { ...row, summary: `${row.summary} (known engine gap, not expected to be found)` }));
	page.acceptable.forEach((f) => finding('ok~', f, `accepted side effect of ${f.for}: `));
	page.knownNoise.forEach((f) => finding('nz ', f, `known engine noise (from ${f.cause}): `));
	page.unexpected.forEach((f) => finding('NEW', f, 'unexpected: '));
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || (!args.file && !args.execution)) {
		console.log('Usage: node scripts/score-run.mjs <execution.json> | <executionId> | --execution <executionId> [--wait] [--strict] [--pages /,/clean] [--json out.json] [--save response.json]');
		process.exit(args.help ? 0 : 2);
	}
	const key = JSON.parse(await readFile(join(ROOT, 'expected-findings.json'), 'utf8'));

	let json;
	if (args.execution) {
		const deadline = Date.now() + 15 * 60 * 1000;
		for (;;) {
			({ json } = await fetchExecution(args.execution));
			const status = unwrapExecution(json)?.execution?.status;
			if (!args.wait || status !== 'running' || Date.now() > deadline) break;
			console.log(`execution ${args.execution} is still running; checking again in 15s`);
			await new Promise((resolve) => setTimeout(resolve, 15_000));
		}
		if (args.save) await writeFile(args.save, JSON.stringify(json, null, 2));
	} else {
		json = JSON.parse(await readFile(args.file, 'utf8'));
	}
	const unwrapped = unwrapExecution(json);
	if (!unwrapped) { console.error('No results found in the input (expected /v2/agents/execution/get with includeResults: true).'); process.exit(2); }
	const { execution, results } = unwrapped;
	if (execution) console.log(`execution ${execution.id ?? '?'}  agent ${execution.agentId ?? '?'}  status ${execution.status ?? '?'}  urls ${results.length}`);
	if (execution?.status === 'running') console.log('warning: the execution is still running; results may be incomplete (use --wait).');

	const byPath = new Map();
	for (const result of results) {
		if (!result?.url) continue;
		byPath.set(normalizePath(result.url), result);
	}
	const entries = key.pages.filter((entry) => !args.pages || args.pages.includes(entry.path));
	const pages = entries.map((entry) => scorePage(entry, byPath.get(entry.path), { strict: args.strict }));
	pages.forEach(printPage);

	const scored = pages.filter((page) => page.compared);
	const extra = [...byPath.keys()].filter((path) => !key.pages.some((entry) => entry.path === path));
	const totals = {
		pagesScored: scored.length,
		expectedFound: scored.reduce((n, p) => n + p.found.length, 0),
		expectedMissed: scored.reduce((n, p) => n + p.missed.length, 0),
		knownGapsFound: scored.reduce((n, p) => n + p.knownGapsFound.length, 0),
		acceptedSideEffects: scored.reduce((n, p) => n + p.acceptable.length, 0),
		knownNoise: scored.reduce((n, p) => n + p.knownNoise.length, 0),
		unexpected: scored.reduce((n, p) => n + p.unexpected.length, 0),
		cleanPageFalsePositives: scored.reduce((n, p) => n + p.falsePositives.length, 0),
		pageProblems: scored.reduce((n, p) => n + p.problems.length, 0),
	};
	console.log(`\nSummary: ${totals.expectedFound} expected found, ${totals.expectedMissed} missed, ${totals.unexpected} unexpected, ${totals.knownNoise} known noise, ${totals.cleanPageFalsePositives} false positive(s) on clean pages, ${totals.knownGapsFound} known gap(s) found anyway; ${totals.pagesScored}/${entries.length} page(s) in this run.`);
	if (extra.length) console.log(`Not in the answer key (ignored): ${extra.join(', ')}`);

	const failed = scored.length === 0 || totals.expectedMissed > 0 || totals.cleanPageFalsePositives > 0 || scored.some((p) => p.skipped);
	if (args.json) await writeFile(args.json, JSON.stringify({ execution: execution ? { id: execution.id, status: execution.status } : null, totals, pages, pass: !failed }, null, 2));
	console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
	process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message || error); process.exit(2); });
