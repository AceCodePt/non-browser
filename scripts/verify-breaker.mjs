#!/usr/bin/env node
/**
 * `npm run verify:breaker`
 *
 * Breaker corpus parity (corpus/breaker/) plus the fallback-vs-Pretext drift
 * gate on the spine corpus. The corpus covers the mechanisms Pretext owns and
 * the greedy wrapper does not: long paragraphs, CJK-without-spaces, long words
 * (overflow-wrap:break-word), hyphens, and forced breaks — each compared
 * against Chrome's real line fragments.
 *
 * For every fixture the engine (running the Pretext breaker — the default) is
 * rendered and its line fragments merged per line and compared with Chrome's
 * `Range.getClientRects()`, merged the same way (Chrome surfaces zero-width
 * newline boxes and several boxes per justified line, so the per-line union is
 * the honest geometry). The report prints line counts and the per-line
 * break-position delta (max |Δx|, |Δwidth|). Exit criteria:
 *   - line-count parity on >= 95% of fixtures (charter breaker parity);
 *   - every fixture whose line count diverges declares `knownDivergence` and
 *     still diverges (a stale declaration fails the run);
 *   - every `knownDivergence` fixture is explained in docs/ledgers/breakers.md.
 *
 * The drift gate then asserts the fallback (`CASCADE_BREAKER=greedy`) and the
 * Pretext path agree on line counts and widths for every corpus/spine text
 * element, so the greedy wrapper cannot silently diverge from the shipped
 * breaker.
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderHtml } from '../dist/layout/render.js';
import { skiaCanvasFactory } from '../dist/canvas/skia.js';
import { setUsePretextBreaker, getUsePretextBreaker } from '../dist/layout/measure.js';

const NOTO = '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const corpus = resolve('corpus/breaker');
const spine = resolve('corpus/spine');

function* fixtures(root) {
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

/**
 * Merge one element's fragments into per-line boxes: fragments sharing a line
 * (same y) are unioned into [x, width]. Both Chrome and the engine may report
 * several boxes per line (newline boxes, per-word justify boxes), so the union
 * is the honest per-line geometry.
 */
function mergeLines(frags) {
  const groups = new Map();
  for (const f of frags) {
    const key = Math.round(f.y * 10) / 10;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const lines = [];
  for (const [key, fs] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    let minX = Infinity;
    let maxRight = -Infinity;
    for (const f of fs) {
      minX = Math.min(minX, f.x);
      maxRight = Math.max(maxRight, f.x + f.width);
    }
    lines.push({ x: minX, width: maxRight - minX });
  }
  return lines;
}

async function chromeLines(page, id) {
  const info = await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const frags = [];
    for (const r of range.getClientRects()) frags.push({ x: r.x, y: r.y, width: r.width, height: r.height });
    return frags;
  }, id);
  if (!info) return [];
  return mergeLines(info);
}

// --- corpus font registrations + per-fixture browser configs ---
const fontsByFamily = new Map();
for (const { raw } of fixtures(corpus)) {
  for (const f of raw.fonts ?? []) {
    if (!fontsByFamily.has(f.family)) fontsByFamily.set(f.family, { family: f.family, filePath: f.file });
  }
}
if (fontsByFamily.size === 0) {
  console.error(`verify:breaker: no fixtures found under ${corpus}`);
  process.exit(1);
}
const config = {
  browser: 'chrome',
  fonts: [...fontsByFamily.values()],
  fallback: {},
  defaultFamily: 'Noto Sans',
  defaultFile: NOTO,
};
for (const f of config.fonts) skiaCanvasFactory.registerFont(f.filePath);

const renderOpts = (raw) => {
  const h = raw.harvest;
  return {
    width: h.viewport.width,
    height: h.viewport.height,
    fontFamily: 'Noto Sans',
    fontFile: NOTO,
    browserConfig: config,
    textElements: h.textElements,
  };
};

const browser = await chromium.launch();
const rows = [];
const failures = [];
const divergences = [];
try {
  for (const { name, raw } of fixtures(corpus)) {
    const h = raw.harvest;
    const page = await browser.newPage({ viewport: { width: h.viewport.width, height: h.viewport.height } });
    await page.setContent(h.html);
    await page.evaluate(() => document.fonts.ready);

    const chromePerId = {};
    for (const id of h.textElements ?? []) chromePerId[id] = await chromeLines(page, id);
    await page.close();

    const out = renderHtml(h.html, renderOpts(raw));
    const enginePerId = {};
    for (const id of h.textElements ?? []) {
      enginePerId[id] = mergeLines((out.textFragments[id] ?? []).map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })));
    }

    let maxDelta = 0;
    let lineCountMatch = true;
    let chromeLinesTotal = 0;
    let engineLinesTotal = 0;
    for (const id of h.textElements ?? []) {
      const c = chromePerId[id] ?? [];
      const e = enginePerId[id] ?? [];
      chromeLinesTotal += c.length;
      engineLinesTotal += e.length;
      if (c.length !== e.length) {
        lineCountMatch = false;
        continue;
      }
      for (let k = 0; k < c.length; k++) {
        maxDelta = Math.max(maxDelta, Math.abs(c[k].x - e[k].x), Math.abs(c[k].width - e[k].width));
      }
    }

    const declared = raw.knownDivergence;
    // A fixture passes when its behavior matches its declaration: parity with
    // no declaration, or divergence with a declaration that still diverges.
    const runPass = lineCountMatch ? declared === undefined : declared !== undefined;
    if (declared && lineCountMatch) {
      failures.push(`fixture '${name}': declares knownDivergence but line counts now match Chrome — reclassify into the pass corpus`);
    }
    if (!lineCountMatch && declared === undefined) {
      failures.push(`fixture '${name}': line counts diverge (Chrome ${chromeLinesTotal} vs engine ${engineLinesTotal}) with no knownDivergence entry`);
    }
    if (!lineCountMatch && declared !== undefined) divergences.push(name);

    rows.push({
      category: raw.category ?? 'misc',
      name,
      chromeLines: chromeLinesTotal,
      engineLines: engineLinesTotal,
      lineCountMatch,
      maxDelta: lineCountMatch ? maxDelta : Number.NaN,
      runPass,
      declared: declared !== undefined,
    });
    console.log(
      `  ${lineCountMatch ? 'PARITY' : 'DIVERGE'} ${raw.category ?? 'misc'}/${name}: Chrome ${chromeLinesTotal} line(s) vs engine ${engineLinesTotal}, ` +
        `break-pos Δ ${lineCountMatch ? maxDelta.toFixed(3) + 'px' : 'n/a'}` +
        (declared ? ' (declared divergence)' : ''),
    );
  }
} finally {
  await browser.close();
}

const parityCount = rows.filter((r) => r.lineCountMatch).length;
const parityRate = rows.length > 0 ? parityCount / rows.length : 0;
const runPassCount = rows.filter((r) => r.runPass).length;

console.log(`\nBreaker corpus: ${parityCount}/${rows.length} fixtures at line-count parity (${(parityRate * 100).toFixed(1)}%, need >= 95%)`);
for (const r of rows) {
  console.log(
    `  ${r.runPass ? 'PASS' : 'FAIL'} ${r.category}/${r.name}: Chrome ${r.chromeLines} vs engine ${r.engineLines} lines, ` +
      `break-pos Δ ${Number.isFinite(r.maxDelta) ? r.maxDelta.toFixed(3) + 'px' : 'n/a'}` +
      (r.declared ? ' [declared divergence]' : ''),
  );
}
if (parityRate < 0.95) failures.push(`line-count parity ${(parityRate * 100).toFixed(1)}% < 95%`);
if (divergences.length > 0) console.log(`\nDeclared divergences (each needs a docs/ledgers/breakers.md entry): ${divergences.join(', ')}`);

// Every declared divergence must be documented in docs/ledgers/breakers.md.
const ledger = readFileSync(resolve('docs/ledgers/breakers.md'), 'utf8');
for (const name of divergences) {
  if (!ledger.includes(name)) failures.push(`fixture '${name}' declares a divergence but docs/ledgers/breakers.md has no entry for it`);
}

// --- drift gate: fallback vs Pretext on the spine corpus ---
console.log('\nDrift gate: greedy fallback vs Pretext on corpus/spine...');
let driftPass = true;
let driftLines = 0;
const spineFailures = [];
if (!getUsePretextBreaker()) {
  // default is Pretext; a leaked CASCADE_BREAKER=greedy makes the whole run moot
  console.error('  FAIL: Pretext breaker is not the active default before the drift run');
  spineFailures.push('Pretext breaker not default');
  driftPass = false;
}
for (const { name, raw } of fixtures(spine)) {
  const h = raw.harvest;
  const opts = renderOpts(raw);
  setUsePretextBreaker(true);
  const pretext = renderHtml(h.html, opts).textFragments;
  setUsePretextBreaker(false);
  const greedy = renderHtml(h.html, opts).textFragments;
  setUsePretextBreaker(true);
  for (const id of h.textElements ?? []) {
    const p = mergeLines((pretext[id] ?? []).map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })));
    const g = mergeLines((greedy[id] ?? []).map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })));
    driftLines += Math.max(p.length, g.length);
    if (p.length !== g.length) {
      driftPass = false;
      spineFailures.push(`spine/${name} id '${id}': Pretext ${p.length} lines vs greedy ${g.length}`);
      continue;
    }
    for (let k = 0; k < p.length; k++) {
      const dx = Math.abs(p[k].x - g[k].x);
      const dw = Math.abs(p[k].width - g[k].width);
      if (dx > 0.01 || dw > 0.01) {
        driftPass = false;
        spineFailures.push(`spine/${name} id '${id}' line ${k}: x Δ ${dx.toFixed(4)}px, width Δ ${dw.toFixed(4)}px`);
      }
    }
  }
}
console.log(`  drift gate: ${driftPass ? 'PASS' : 'FAIL'} over ${driftLines} line(s)`);
for (const f of spineFailures) console.log(`    - ${f}`);
if (!driftPass) failures.push('drift gate: fallback and Pretext diverge on the spine corpus');

const ok = failures.length === 0;
console.log(ok ? `\nPASS: verify:breaker — ${runPassCount}/${rows.length} fixtures clean, drift gate green` : `\nFAIL: verify:breaker — ${failures.length} problem(s)`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(ok ? 0 : 1);
