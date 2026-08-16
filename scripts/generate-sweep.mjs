#!/usr/bin/env node
/**
 * `npm run generate:sweep`
 *
 * Programmatic value-sweep: generate corpus/sweep-flexbox/ and corpus/sweep-grid/
 * fixtures by sweeping property/value combinations (charter §11 coverage matrix):
 *   - flex: flex-wrap x justify-content x align-items
 *   - grid: grid-template-columns x gap
 *
 * One fixture per combination, all HTML generated from the axis tables in
 * scripts/lib/sweep.mjs — nothing hand-authored.
 *
 * Every fixture is diffed against headless Chrome on the rect layer here (the
 * layer that decides geometry parity), and its `expected` is written to match
 * reality:
 *   - a combo that matches Chrome gets `expected: all pass`;
 *   - a combo that diverges gets a typed gap on `rect` (and `screenshot`) with
 *     a reason and sunset, so it is *documented in the ledger* (docs/ledgers/
 *     sweep.md, written by verify-sweep.mjs) rather than silently excluded.
 *
 * The generator therefore never fakes a row: a fixture only claims pass if the
 * engine actually reproduced Chrome in this run, and a divergence is recorded
 * (fixture gap + ledger) instead of dropped. `npm run verify:sweep` re-diffs
 * and asserts every recorded expectation still holds.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { renderHtml } from '../dist/layout/render.js';
import { sweepCombos } from './lib/sweep.mjs';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';
const corpusRoot = resolve('corpus');
const tolerances = loadTolerances(resolve('tolerances.json'));
const rectTol = tolerances.layers.rect.maxPx;

for (const feature of ['flexbox', 'grid']) {
  rmSync(join(corpusRoot, `sweep-${feature}`), { recursive: true, force: true });
  mkdirSync(join(corpusRoot, `sweep-${feature}`), { recursive: true });
}

function gapFor(label) {
  return {
    result: 'fail',
    reason:
      `value-sweep combo '${label}': the engine does not reproduce Chrome's geometry for this combination ` +
      `(rect delta exceeds the ${rectTol}px tolerance) — measured in the generate:sweep run; documented here and in docs/ledgers/sweep.md rather than silently excluded.`,
    sunset:
      'reclassify to pass (remove this gap) when the engine matches Chrome on this property/value combination.',
  };
}

const browser = await chromium.launch();
let generated = 0;
let gaps = 0;
try {
  for (const combo of sweepCombos()) {
    const featureDir = combo.feature === 'flex' ? 'flexbox' : 'grid';
    const dir = join(corpusRoot, `sweep-${featureDir}`, combo.dirName);
    mkdirSync(dir, { recursive: true });

    const viewport = combo.viewport;
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.setContent(combo.html);
    const referenceRects = {};
    for (const id of combo.rects) {
      referenceRects[id] = await page.$eval(`#${id}`, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    }
    const shot = await page.screenshot();
    const refImg = decodePng(shot);
    await page.close();

    const out = renderHtml(combo.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: FONT_FAMILY,
      fontFile: FONT_FILE,
    });
    const candImg = decodePng(out.rgba);

    // Use the SAME harness evaluation the verifiers run, so the recorded
    // expectation is exactly what verify-sweep will assert later.
    const fixture = {
      name: combo.dirName,
      expected: { measureText: 'pass', computedStyle: 'pass', rect: 'pass', screenshot: 'pass' },
      tolerances,
      referenceRgba: refImg.data,
      candidateRgba: candImg.data,
      mask: null,
      reference: { measureText: {}, computedStyle: {}, rect: referenceRects },
      candidate: { measureText: {}, computedStyle: {}, rect: out.rects },
      width: refImg.width,
      height: refImg.height,
    };
    const harness = evaluateFixture(fixture);
    const rectLayer = harness.layers.rect;
    const shotLayer = harness.layers.screenshot;

    const expected = { measureText: 'pass', computedStyle: 'pass' };
    expected.rect = rectLayer.pass ? 'pass' : gapFor(combo.label);
    expected.screenshot = shotLayer.pass ? 'pass' : gapFor(combo.label);

    const passAll = rectLayer.pass && shotLayer.pass;
    const fixtureJson = {
      name: combo.dirName,
      note: `Value-sweep fixture (${combo.feature}): ${combo.label}. Generated programmatically by scripts/generate-sweep.mjs from the ${combo.feature} axis tables.${passAll ? '' : ` KNOWN DIVERGENCE — documented in docs/ledgers/sweep.md (rect max Δ ${rectLayer.maxDelta.toFixed(3)}px).`}`,
      harvest: {
        viewport: combo.viewport,
        html: combo.html,
        measureText: [],
        rects: combo.rects,
        textElements: [],
      },
      expected,
    };
    writeFileSync(join(dir, 'fixture.json'), JSON.stringify(fixtureJson, null, 2) + '\n');

    // Persist the oracle + candidate artifacts exactly like the hand-authored corpora.
    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify({ measureText: {}, computedStyle: {}, rect: referenceRects }, null, 2) + '\n',
    );
    writeFileSync(join(dir, 'candidate.json'), JSON.stringify({ measureText: {}, computedStyle: {}, rect: out.rects }, null, 2) + '\n');
    writeFileSync(join(dir, 'reference.png'), shot);
    writeFileSync(join(dir, 'candidate.png'), encodePng(candImg.width, candImg.height, candImg.data));

    if (passAll) {
      generated++;
      console.log(`  ${combo.dirName}: pass (rect max Δ ${rectLayer.maxDelta.toFixed(3)}px, screenshot ${shotLayer.exceedingPixels} exceeding)`);
    } else {
      gaps++;
      console.log(`  ${combo.dirName}: GAP (rect max Δ ${rectLayer.maxDelta.toFixed(3)}px, screenshot ${shotLayer.exceedingPixels} exceeding)`);
    }
  }
} finally {
  await browser.close();
}

console.log(`generate:sweep — ${generated} passing fixtures, ${gaps} documented divergences (see docs/ledgers/sweep.md)`);
