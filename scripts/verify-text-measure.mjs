#!/usr/bin/env node
/**
 * `npm run verify:text-measure`
 *
 * Layer-1 (measureText) parity corpus: every string in corpus/measure-corpus is
 * measured twice against the same registered font files — once with the engine's
 * Canvas interface `measureText` (skia), once with a real Chrome canvas
 * `ctx.measureText` via Playwright (the oracle). Letter-spaced entries use the
 * engine's documented Blink semantics (base advance from the interface +
 * letterSpacing × codepoint count) against Chrome's `ctx.letterSpacing`.
 *
 * The sub-pixel tolerance (mean <= 0.01px, no string > 0.5px, per charter §2 /
 * tolerances.json) is applied by the harness layer-1 runner
 * (`evaluateMeasureText`), not reimplemented here. Categories whose fixtures
 * declare a typed gap on a layer (`expected.<layer>: { result:'fail', reason,
 * sunset }`, see scripts/lib/expected.mjs) are documented known gaps: every gap
 * entry must still diverge (each needs a `reason`), so a gap that closes
 * surfaces as a failure and can be reclassified into the pass corpus.
 *
 * Writes the per-string ledger docs/ledgers/text-measure.md (widths, deltas,
 * pass/fail, failing fonts, run summary). Exits 0 only when the pass corpus is
 * within tolerance and every documented gap still diverges.
 */

import { chromium } from 'playwright';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { evaluateMeasureText } from '../dist/harness/evaluate.js';
import { skiaCanvasFactory } from '../dist/canvas/index.js';
import { gapLayers, expectedLabel } from './lib/expected.mjs';

const corpus = resolve('corpus/measure-corpus');
const ledgerPath = resolve('docs/ledgers/text-measure.md');

/** Round to 4 significant-ish digits for display. */
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(4) : 'n/a');

function* fixtures() {
  if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`verify:text-measure: corpus directory missing: ${corpus}`);
    process.exit(1);
  }
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fpath = join(corpus, entry.name, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

// --- register the corpus font set into the engine's Canvas interface ---
const registeredFamilies = new Set();
for (const { name, raw } of fixtures()) {
  for (const f of raw.fonts ?? []) {
    if (!existsSync(f.file)) {
      console.error(`verify:text-measure: fixture '${name}' references missing font file: ${f.file}`);
      process.exit(1);
    }
    if (registeredFamilies.has(f.family)) continue;
    try {
      skiaCanvasFactory.registerFont(f.file, f.family);
    } catch (err) {
      console.error(`verify:text-measure: failed to register font '${f.family}' from ${f.file}: ${err.message}`);
      process.exit(1);
    }
    registeredFamilies.add(f.family);
  }
}
const canvas = skiaCanvasFactory.create(1, 1);

const tolerances = loadTolerances(resolve('tolerances.json'));
const mt = tolerances.layers.measureText;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

/** Chrome oracle width: ctx.letterSpacing mirrors the engine's ls×len model. */
async function chromeMeasure(text, font, letterSpacing) {
  return page.evaluate(
    ({ text, font, ls }) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = font;
      if (ls !== 0) ctx.letterSpacing = `${ls}px`;
      return ctx.measureText(text).width;
    },
    { text, font, ls: letterSpacing ?? 0 },
  );
}

/** Engine candidate width: the Canvas interface's measureText, plus ls×len. */
function engineMeasure(text, font, letterSpacing) {
  const base = canvas.measureText(text, font).width;
  return base + (letterSpacing ?? 0) * text.length;
}

const keyOf = (text, font, ls) => (ls && ls !== 0 ? `${font} | ls=${ls}px | ${text}` : `${font} | ${text}`);

/** Escaped text for the ledger so tabs/control chars stay readable. */
const controlRe = new RegExp('[\\x00-\\x1f\\x7f]', 'u');
const esc = (s) => (controlRe.test(s) ? JSON.stringify(s) : s);

let allPass = true;
const failures = [];
const categoryRows = []; // { name, note, expected, strings, meanDelta, maxDelta, checkPass }
const stringRows = []; // { category, text, font, letterSpacing, engine, chrome, delta, pass, reason }
let worstDelta = 0;
let totalStrings = 0;

try {
  for (const { name, raw } of fixtures()) {
    const entries = raw.entries ?? [];
    const isGapFixture = gapLayers(raw.expected).length > 0;
    const passEntries = [];
    const gapEntries = [];
    for (const e of entries) {
      if (isGapFixture) {
        if (!e.reason) throw new Error(`fixture ${name}: expected:fail entries need a 'reason'`);
        gapEntries.push(e);
      } else {
        if (e.expected) throw new Error(`fixture ${name}: entry-level expected is retired; declare a typed fixture-level expected.<layer> gap`);
        passEntries.push(e);
      }
    }

    const candidate = { measureText: {} };
    const reference = { measureText: {} };
    for (const e of [...passEntries, ...gapEntries]) {
      const ref = await chromeMeasure(e.text, e.font, e.letterSpacing);
      const cand = engineMeasure(e.text, e.font, e.letterSpacing);
      const delta = Math.abs(cand - ref);
      const key = keyOf(e.text, e.font, e.letterSpacing);
      reference.measureText[key] = ref;
      candidate.measureText[key] = cand;
      stringRows.push({
        category: name,
        text: e.text,
        font: e.font,
        letterSpacing: e.letterSpacing ?? 0,
        engine: cand,
        chrome: ref,
        delta,
        pass: delta <= mt.maxPx,
        reason: e.reason ?? '',
        expected: isGapFixture ? 'fail' : 'pass',
      });
    }

    // Harness layer-1 runner decides tolerance on the pass corpus of this fixture.
    const fixture = { name, tolerances, candidate, reference };
    const layer = evaluateMeasureText(fixture);

    let checkPass;
    let detail;
    if (isGapFixture) {
      // Documented known gap: every entry must still diverge.
      const closed = gapEntries.filter((e) => {
        const key = keyOf(e.text, e.font, e.letterSpacing);
        return Math.abs((candidate.measureText[key] ?? NaN) - (reference.measureText[key] ?? NaN)) <= mt.maxPx;
      });
      checkPass = layer.pass === false && closed.length === 0;
      detail =
        `${gapEntries.length} gap string(s); still diverging: ${gapEntries.length - closed.length}/${gapEntries.length}` +
        (closed.length > 0 ? `; ${closed.length} no longer diverge: ${closed.map((e) => JSON.stringify(e.text)).join(', ')}` : '');
    } else {
      checkPass = layer.pass;
      detail = `mean Δ ${fmt(layer.meanDelta)}px, max Δ ${fmt(layer.maxDelta)}px over ${layer.strings} string(s)`;
    }

    const worstHere = Math.max(...stringRows.filter((r) => r.category === name).map((r) => r.delta));
    if (worstHere > worstDelta) worstDelta = worstHere;
    const catCount = stringRows.filter((r) => r.category === name).length;
    totalStrings += catCount;

    categoryRows.push({
      name,
      note: raw.note ?? '',
      expected: expectedLabel(raw.expected),
      strings: catCount,
      meanDelta: catCount > 0 ? stringRows.filter((r) => r.category === name).reduce((s, r) => s + r.delta, 0) / catCount : 0,
      maxDelta: worstHere,
      checkPass,
      detail,
    });

    if (!checkPass) {
      allPass = false;
      failures.push(`fixture '${name}': ${detail}`);
    }
    console.log(`  ${name}: ${checkPass ? 'PASS' : 'FAIL'} — ${detail}`);
  }
} finally {
  await browser.close();
}

// --- summary ---
const passStrings = stringRows.filter((r) => r.expected !== 'fail' && r.pass).length;
const passExpected = stringRows.filter((r) => r.expected !== 'fail').length;
const passRows = stringRows.filter((r) => r.expected !== 'fail');
const gaps = stringRows.filter((r) => r.expected === 'fail');
const passMeanDelta = passRows.length > 0 ? passRows.reduce((s, r) => s + r.delta, 0) / passRows.length : 0;
const passWorstDelta = passRows.length > 0 ? Math.max(...passRows.map((r) => r.delta)) : 0;
const passRate = passExpected > 0 ? passStrings / passExpected : 1;
const failingFonts = new Set(stringRows.filter((r) => !r.pass).map((r) => r.font.replace(/^.*?([\d.]+)px\s*/, '')).map((f) => f.replace(/['"]/g, '')));

// --- ledger ---
const md = [];
md.push('# Text-Measure Ledger');
md.push('');
md.push(
  'Owning seam: the generic Canvas interface (`src/canvas/`) with the skia implementation (`src/canvas/skia.ts`); measurement consumers live in `src/layout/measure.ts` (`measureTextWidth`) and Pretext\'s measurement context (`src/pretext/`). Layer-1 corpus: `corpus/measure-corpus/`, `npm run verify:text-measure`.',
);
md.push('');
md.push('## Scope');
md.push('');
md.push(
  'Per-string shaped advances resolved against the registered font set: the engine measures with the Canvas interface\'s `measureText` for a CSS font shorthand string, and the oracle measures the same string with a real Chrome `ctx.measureText` (Playwright) using the same registered font files (the engine registers the corpus faces via `registerFont`; Chrome resolves the same system-installed faces). Both ride Skia/HarfBuzz, so the layer-1 tolerance is sub-pixel.',
);
md.push('');
md.push('## Latest Run');
md.push('');
md.push(`- Generated: ${new Date().toISOString()}`);
md.push(`- Strings measured: ${totalStrings} (${passExpected} pass corpus + ${gaps.length} documented known gaps)`);
md.push(`- Pass rate (pass corpus): ${(passRate * 100).toFixed(1)}% (${passStrings}/${passExpected} within tolerance)`);
md.push(`- Mean delta (pass corpus): ${fmt(passMeanDelta)}px`);
md.push(`- Worst delta (pass corpus): ${fmt(passWorstDelta)}px`);
md.push(`- Worst delta (all strings, incl. gaps): ${fmt(worstDelta)}px`);
md.push(`- Tolerance: mean ≤ ${mt.meanPx}px, no string > ${mt.maxPx}px (charter §2, tolerances.json v${tolerances.version})`);
md.push(`- Categories: ${categoryRows.length}, all ${allPass ? 'PASS' : 'FAIL'}`);
md.push('');
md.push('## Categories');
md.push('');
md.push('| Category | Strings | Expected | Mean Δ px | Max Δ px | Result |');
md.push('|---|---|---|---|---|---|');
for (const c of categoryRows) {
  md.push(
    `| ${c.name} | ${c.strings} | ${c.expected} | ${fmt(c.meanDelta)} | ${fmt(c.maxDelta)} | ${c.checkPass ? 'PASS' : 'FAIL'} |`,
  );
}
md.push('');
md.push('## Per-String Results');
md.push('');
md.push('| Category | String | Font | Engine px | Chrome px | Δ px | Result |');
md.push('|---|---|---|---|---|---|---|');
for (const r of stringRows) {
  const result = r.expected === 'fail' ? 'GAP' : r.pass ? 'PASS' : 'FAIL';
  md.push(
    `| ${r.category} | ${esc(r.text)} | ${r.font}${r.letterSpacing ? ` ls=${r.letterSpacing}` : ''} | ${fmt(r.engine)} | ${fmt(r.chrome)} | ${fmt(r.delta)} | ${result} |`,
  );
}
md.push('');
md.push('## Failing Fonts');
md.push('');
if (failingFonts.size === 0) {
  md.push('None — every measured string is within tolerance.');
} else {
  md.push(`Fonts whose strings exceeded tolerance this run: ${[...failingFonts].join(', ')}.`);
  md.push('');
  md.push('All of them are covered by documented known gaps (see below); an unexpected failure here fails the run.');
}
md.push('');
md.push('## Known Gaps (Documented Divergences)');
md.push('');
md.push('Failures are permitted only for the following documented divergences; the verify script asserts each still diverges so a closed gap must be reclassified into the pass corpus.');
md.push('');
for (const g of gaps) {
  md.push(`- **${esc(g.text)}** @ ${g.font}${g.letterSpacing ? `, ls ${g.letterSpacing}` : ''} — Δ ${fmt(g.delta)}px: ${g.reason}`);
}
md.push('');
md.push('## Coverage');
md.push('');
md.push(
  '- **Latin** (`latin/`): Noto Sans at 10–48px, uppercase/lowercase, digits, ligatures, kerning, punctuation, nbsp; bold/semibold/italic via font shorthand; Liberation Sans/Serif/Mono, DejaVu Sans, Source Code Pro.',
);
md.push('- **CJK** (`cjk/`): Simplified Chinese and Japanese (kanji/kana) on Droid Sans Fallback / Droid Sans Japanese, incl. CJK punctuation.',
);
md.push('- **RTL** (`rtl/`): Arabic (harakat, Arabic-Indic digits) on Droid Arabic Kufi; Hebrew (niqqud) on Droid Sans Hebrew.',
);
md.push('- **Emoji** (`emoji/`): ZWJ family/kiss, flags, keycaps, skin tones on Noto Sans; dingbats, arrows, symbols on DejaVu Sans.',
);
md.push('- **Combining marks** (`combining-marks/`): decomposed/precomposed/double Latin diacritics on Noto Sans; Devanagari conjuncts, matras, digits on Droid Sans Devanagari.',
);
md.push('- **Tab runs** (`tabs/`): tabs on monospace faces (Source Code Pro, Liberation Mono).',
);
md.push('- **Letter-spaced** (`letter-spacing/`): positive, fractional, negative spacing on Latin and CJK.',
);

writeFileSync(ledgerPath, md.join('\n') + '\n');

const summary = [
  `verify:text-measure: ${totalStrings} strings, pass-corpus mean Δ ${fmt(passMeanDelta)}px / worst Δ ${fmt(passWorstDelta)}px, ` +
    `pass rate ${(passRate * 100).toFixed(1)}% (${passStrings}/${passExpected})`,
  `failing fonts: ${failingFonts.size === 0 ? 'none' : [...failingFonts].join(', ')}`,
  `ledger: ${ledgerPath}`,
];
if (allPass) {
  console.log(`PASS: ${summary.join('\n      ')}`);
  process.exit(0);
}
console.log(`FAIL: ${summary.join('\n      ')}`);
for (const f of failures) console.log(`      - ${f}`);
process.exit(1);
