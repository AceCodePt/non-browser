#!/usr/bin/env node
/**
 * `npm run verify:layers` (wired into session-idle as the *layers* gate by
 * `.orchestration/hooks/session-idle`).
 *
 * Proves the selective-render entry functions are the full pipeline cut at
 * their layer, not a reimplementation:
 *   - rectsOf(html, opts).rects            === renderHtml(html, opts).rects
 *   - computedStylesOf(html, opts).computedStyles === renderHtml(html, opts).computedStyles
 * byte-identical, for every renderable corpus fixture (any fixture whose
 * harvest has html + a viewport). The full call's output additionally has to
 * match the pre-refactor baseline manifest (docs/ledgers/layers-baseline.json)
 * hash-for-hash, so the default renderHtml path cannot have moved a byte.
 *
 * Measures the cascade-vs-layout-vs-paint cost split per corpus/spine fixture
 * and records it in docs/ledgers/layers.md. The split is derived from timed
 * entry-point calls, each stopping at the stage it asks for:
 * computedStylesOf = prepare (parse+cascade+resolveStyles), rectsOf =
 * prepare+layout, renderHtml = prepare+layout+paint; the median-of-5 total of
 * each, with layout/paint attributed as the difference between consecutive
 * entries. Cheap-call guidance in README is grounded in these numbers.
 *
 * `--capture-baseline` regenerates the baseline manifest instead of checking
 * it — run it once against a known-good tree, commit the manifest, then let
 * the gate mode compare. Exits non-zero on any mismatch.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderHtml, rectsOf, computedStylesOf } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';
const BASELINE = resolve('docs/ledgers/layers-baseline.json');
const LEDGER = resolve('docs/ledgers/layers.md');
const captureBaseline = process.argv.includes('--capture-baseline');

function sha256(parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
}

function hashFullOutput(out) {
  return sha256([
    out.rgba,
    JSON.stringify({
      width: out.width,
      height: out.height,
      rects: out.rects,
      generatedTextRects: out.generatedTextRects,
      textFragments: out.textFragments,
      listMarkers: out.listMarkers,
      computedStyles: out.computedStyles,
    }),
  ]);
}

function renderOptsFor(h) {
  const vp = h.viewport ?? (h.viewports ?? [])[0];
  return {
    width: vp.width,
    height: vp.height,
    fontFamily: FONT_FAMILY,
    fontFile: FONT_FILE,
    computedStyle: h.computedStyle,
    media: {
      prefersColorScheme: vp.prefersColorScheme,
      prefersReducedMotion: vp.prefersReducedMotion,
      dppx: vp.dppx,
    },
  };
}

function* renderableFixtures() {
  for (const group of readdirSync('corpus').sort((a, b) => a.localeCompare(b))) {
    const gpath = join('corpus', group);
    if (!statSync(gpath, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const entry of readdirSync(gpath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const dir = join(gpath, entry.name);
      const fpath = join(dir, 'fixture.json');
      if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
      const raw = JSON.parse(readFileSync(fpath, 'utf8'));
      const h = raw.harvest;
      if (!h?.html || !(h.viewport ?? h.viewports?.[0])) continue;
      yield { key: `${group}/${entry.name}`, group, dir, raw, h };
    }
  }
}

/** Timed stage split for one spine fixture. The three entry calls run
 * back-to-back per pass, so one noisy cycle (GC, lazy skia init) shifts all
 * three equally; layout/paint are attributed from differences within the same
 * pass, and the minimum pass wins for each quantity. Warm (one untimed pass
 * first). */
function stageCosts(fixture, opts, passes) {
  const triples = [];
  for (let pass = 0; pass < passes; pass++) {
    const t0 = performance.now();
    computedStylesOf(fixture, opts);
    const t1 = performance.now();
    rectsOf(fixture, opts);
    const t2 = performance.now();
    renderHtml(fixture, opts);
    const t3 = performance.now();
    triples.push({ css: t1 - t0, rects: t2 - t1, full: t3 - t2 });
  }
  const min = (f) => Math.min(...triples.map((t) => f(t)));
  return {
    cascadeMs: round3(min((t) => t.css)),
    layoutMs: round3(min((t) => t.rects - t.css)),
    paintMs: round3(min((t) => t.full - t.rects)),
    fullMs: round3(min((t) => t.full)),
  };
}

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

const fixtures = [...renderableFixtures()];
if (fixtures.length === 0) {
  console.error('verify:layers: no renderable corpus fixtures found');
  process.exit(1);
}

let baseline;
if (!captureBaseline) {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
}

const spineCosts = [];
let rectLayerChecked = 0;
let styleLayerChecked = 0;
let baselineMismatches = 0;
const failures = [];

for (const { key, group, raw, h } of fixtures) {
  const opts = renderOptsFor(h);

  const full = renderHtml(h.html, opts);

  const rectOut = rectsOf(h.html, opts);
  assert.deepEqual(rectOut.width, full.width);
  assert.deepEqual(rectOut.height, full.height);
  if (JSON.stringify(rectOut.rects) !== JSON.stringify(full.rects)) {
    failures.push(`${key}: rectsOf().rects !== renderHtml().rects`);
  }
  rectLayerChecked++;

  if (opts.computedStyle) {
    const styleOut = computedStylesOf(h.html, opts);
    assert.deepEqual(styleOut.width, full.width);
    assert.deepEqual(styleOut.height, full.height);
    if (JSON.stringify(styleOut.computedStyles) !== JSON.stringify(full.computedStyles)) {
      failures.push(`${key}: computedStylesOf().computedStyles !== renderHtml().computedStyles`);
    }
    styleLayerChecked++;
  }

  const fullHash = hashFullOutput(full);
  if (captureBaseline) {
    baseline ??= { generatedAt: new Date().toISOString(), fixtures: {} };
    baseline.fixtures[key] = {
      sha256: fullHash,
      width: full.width,
      height: full.height,
      rectCount: Object.keys(full.rects).length,
      computedStyleCount: Object.keys(full.computedStyles).length,
    };
  } else if (baseline.fixtures[key]?.sha256 !== fullHash) {
    baselineMismatches++;
    failures.push(`${key}: full renderHtml output differs from the pre-refactor baseline (was ${baseline.fixtures[key]?.sha256 ?? 'absent'}, now ${fullHash})`);
  }

  if (group === 'spine') {
    spineCosts.push({ fixture: raw.name ?? key, ...stageCosts(h.html, opts, 9) });
  }
}

if (captureBaseline) {
  baseline.generatedAt = new Date().toISOString();
  baseline.generatedBy = 'scripts/verify-layers.mjs --capture-baseline (pre-refactor renderHtml)';
  writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
  console.log(`verify:layers: baseline captured for ${Object.keys(baseline.fixtures).length} fixtures -> ${BASELINE}`);
} else {
  const fixtureCount = Object.keys(baseline.fixtures).length;
  if (fixtureCount !== fixtures.length) {
    failures.push(`baseline covers ${fixtureCount} fixtures, corpus has ${fixtures.length}`);
  }
}

// --- ledger ---
const ledgerLines = [
  '# Layers Ledger — selective render entry functions',
  '',
  '- Generated: ' + new Date().toISOString(),
  '- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)',
  '- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.',
  '- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.',
  '',
  '## Cost split per spine fixture',
  '',
  '| fixture | cascade ms | layout ms | paint ms | full ms |',
  '|---|---|---|---|---|',
];
for (const c of spineCosts) {
  ledgerLines.push(`| ${c.fixture} | ${c.cascadeMs} | ${c.layoutMs} | ${c.paintMs} | ${c.fullMs} |`);
}
ledgerLines.push('');
mkdirSync(resolve('docs/ledgers'), { recursive: true });
writeFileSync(LEDGER, ledgerLines.join('\n') + '\n');

console.log(`verify:layers: ${fixtures.length} fixtures, ${rectLayerChecked} rect layers, ${styleLayerChecked} style layers compared`);

if (failures.length > 0) {
  for (const f of failures.slice(0, 20)) console.error(`  FAIL ${f}`);
  console.error(`verify:layers: FAIL (${failures.length} failure(s))`);
  process.exit(1);
}
console.log('verify:layers: PASS (selective layers byte-identical to full call; full call byte-identical to pre-refactor baseline)');
process.exit(0);