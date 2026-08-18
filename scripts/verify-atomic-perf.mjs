#!/usr/bin/env node
/**
 * `npm run verify:atomic-perf`
 *
 * Intrinsic sizing / measurement of inline-block ("atomic") boxes used to be
 * unmemoized: sizing an auto-width inline-block measures its whole subtree, and
 * every atomic was measured once for line-breaking and again for placement — so
 * nested inline-blocks re-measured every level below them, twice, giving
 * O(2^depth) work. Deeply nested inline-blocks (a real WPT flex reference, or
 * the progressive nesting a stray self-closing `<div/>` produces in the HTML
 * parser) hung the engine for minutes / OOM-killed the process.
 *
 * atomicBoxSize/measureAtomic are now memoized per (element, width), which is
 * linear. This gate renders pathological nesting and asserts it finishes fast;
 * the pre-fix engine could not complete depth 14 in two minutes.
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { renderHtml } from '../dist/index.js';

const FONT_FILE = process.env.FONT_FILE ?? resolve('fonts/HackNerdFont-Regular.ttf');
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Hack Nerd Font';
const BUDGET_MS = Number(process.env.ATOMIC_BUDGET_MS ?? 5000); // generous; pre-fix hung > 120s at depth 14
const render = (body) =>
  renderHtml(`<!doctype html><html><head><style>body{margin:0;font:16px '${FONT_FAMILY}'}</style></head><body>${body}</body></html>`,
    { width: 800, height: 600, fontFamily: FONT_FAMILY, fontFile: FONT_FILE });

let pass = 0;
const fails = [];
const timed = (name, body) => {
  const t = Date.now();
  try { render(body); } catch (e) { fails.push(`${name}: threw ${e.message}`); return; }
  const ms = Date.now() - t;
  if (ms > BUDGET_MS) fails.push(`${name}: took ${ms}ms > ${BUDGET_MS}ms budget (exponential regression?)`);
  else { pass++; console.log(`  ${name}: ${ms}ms`); }
};

// Deep nested inline-blocks — the exponential shape.
let ib = 'x';
for (let i = 0; i < 200; i++) ib = `<span style="display:inline-block">${ib}</span>`;
timed('nested inline-block depth 200', ib);

// Progressive nesting from self-closing <div/> in HTML parsing (the WPT ref).
let sc = '';
for (let i = 0; i < 80; i++) sc += `<div style="line-height:0"><div style="display:inline-block;width:10px;height:10px"/><div style="display:inline-block;width:50px;height:10px"/></div>`;
timed('80 self-closing-div blocks', sc);

// Correctness: memoization must not change layout — deep nesting still resolves.
try {
  const r = render(`<span id="o" style="display:inline-block"><span id="i" style="display:inline-block;width:30px;height:12px"></span></span>`).rects;
  assert.ok(r.o && r.i && r.i.width === 30, 'nested inline-block rects wrong');
  pass++;
} catch (e) { fails.push(`nested rect correctness: ${e.message}`); }

for (const f of fails) console.log(`FAIL ${f}`);
console.log(`${pass}/${pass + fails.length} atomic-perf checks passed`);
if (fails.length) { console.error('verify:atomic-perf: FAIL'); process.exit(1); }
console.log('verify:atomic-perf: PASS');
