#!/usr/bin/env node
/**
 * `npm run probe:browser-gap`
 *
 * Cross-browser oracle probe: renders the SAME HTML in Playwright Chrome and
 * Playwright Firefox, harvests all four layers from each, and diffs the two
 * browsers directly against each other — no engine in the loop.
 *
 * Answers the strategic question "are Chrome and Firefox different enough to
 * chase the browser-config/fallback plumbing?" with data:
 *   - measureText  widths per string, mean/max Δ (Chrome vs Firefox)
 *   - computedStyle per-prop string equality
 *   - rect          per-box dimension Δ
 *   - screenshot    pixel ΔE over non-text pixels AND the text region
 *                   (reuses comparePixelBuffers' text-tier mask, so text
 *                   pixels are reported separately, not silently excluded)
 *
 * Text pixels are reported via the textMask tier (exceedPct 97 from
 * tolerances.json): this reveals whether the browser gap is structural
 * (measureText/rect) or rasterization-only (ΔE at glyph edges).
 *
 * Pure logic lives in lib/probe-gap-lib.mjs and is covered by
 * probe-gap-lib.test.mjs; this script is the browser-driven harness.
 */

import { chromium, firefox } from 'playwright';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng } from '../dist/harness/png.js';
import { comparePixelBuffers } from '../dist/harness/deltaE.js';
import { resolve } from 'node:path';
import { MASK_PAD, rectsToTextMask, compareLayers, validateFixtures, FIXTURES } from './lib/probe-gap-lib.mjs';

const tolerances = loadTolerances(resolve('tolerances.json'));
const TOL = tolerances.layers;

const validation = validateFixtures(FIXTURES);
const invalid = validation.filter((v) => v.problems.length > 0);
if (invalid.length > 0) {
  console.error('probe:browser-gap: fixture validation failed:');
  for (const v of invalid) console.error(`  ${v.fixture}: ${v.problems.join('; ')}`);
  process.exit(1);
}

/** Harvest all four layers from one browser for one fixture. */
async function harvest(page, f) {
  const { width, height } = f.viewport;
  await page.setContent(f.html);
  await page.evaluate(() => document.fonts.ready);

  const referenceMeasure = {};
  for (const { text, font } of f.measureText ?? []) {
    referenceMeasure[`${font} | ${text}`] = await page.evaluate(
      ({ text, font }) => {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = font;
        return ctx.measureText(text).width;
      },
      { text, font },
    );
  }

  const referenceComputed = {};
  for (const { id, props } of f.computedStyle ?? []) {
    referenceComputed[id] = await page.evaluate(
      ({ id, props }) => {
        const cs = getComputedStyle(document.getElementById(id));
        const out = {};
        for (const p of props) out[p] = cs.getPropertyValue(p);
        return out;
      },
      { id, props },
    );
  }

  const referenceRects = {};
  for (const id of f.rects ?? []) {
    referenceRects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  }

  // Text fragments: used for the text-region mask AND line-level diff.
  const fragments = [];
  const widthsById = {};
  const textsById = {};
  if (f.textElements && f.textElements.length > 0) {
    for (const id of f.textElements) {
      const info = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const range = document.createRange();
        range.selectNodeContents(el);
        const frags = [];
        for (const r of range.getClientRects()) frags.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        return { text: el.textContent, frags };
      }, id);
      if (!info) continue;
      fragments.push(...info.frags);
      textsById[id] = info.text ?? '';
      widthsById[id] = info.frags.map((frag) => frag.width);
    }
  }

  const shot = await page.screenshot();
  const img = decodePng(shot);
  return {
    measureText: referenceMeasure,
    computedStyle: referenceComputed,
    rects: referenceRects,
    fragments,
    textsById,
    widthsById,
    rgba: img.data,
    width: img.width,
    height: img.height,
  };
}

const chrome = await chromium.launch();
const ff = await firefox.launch();
const chromePage = await chrome.newPage();
const ffPage = await ff.newPage();

console.log('Chrome-vs-Firefox direct comparison (no engine). Text pixels reported separately.\n');

for (const f of FIXTURES) {
  console.log(`=== ${f.name}: ${f.note}`);
  const c = await harvest(chromePage, f);
  const fx = await harvest(ffPage, f);

  // Layers 1-3 + line fragments via the shared pure logic.
  const r = compareLayers(c, fx, f);
  console.log(
    `  measureText: ${r.measureText.count} string(s), mean Δ ${r.measureText.meanDelta.toFixed(4)}px, max Δ ${r.measureText.maxDelta.toFixed(4)}px` +
    (r.measureText.deltas.length ? `  [${r.measureText.deltas.map((d) => d.toFixed(3)).join(', ')}]` : '') +
    (r.measureText.exceeds ? `  !! exceeds layer-1 maxPx ${TOL.measureText.maxPx}px` : ''),
  );
  console.log(`  computedStyle: ${r.computedStyle.count} prop(s), ${r.computedStyle.mismatches} mismatch(es)`);
  for (const m of r.computedStyle.details) {
    console.log(`    mismatch #${m.id}.${m.prop}: chrome="${m.chrome}" firefox="${m.firefox}"`);
  }
  console.log(
    `  rect: ${r.rect.boxes} box(es), ${r.rect.dims} dim(s), max Δ ${r.rect.maxDelta.toFixed(4)}px` +
    (r.rect.exceeds ? `  !! exceeds layer-3 maxPx ${TOL.rect.maxPx}px` : ''),
  );
  for (const lf of r.lineFragments) {
    if (!lf.sameCount) {
      console.log(`  fragments #${lf.id}: chrome ${lf.chromeLines} line(s) vs firefox ${lf.firefoxLines} line(s)`);
    } else if (lf.chromeLines > 0) {
      console.log(`  lineFragments #${lf.id}: ${lf.chromeLines} line(s), mean Δ ${lf.meanDelta.toFixed(4)}px, max Δ ${lf.maxDelta.toFixed(4)}px`);
    }
  }

  // Layer 4: screenshot — Chrome as reference, Firefox as candidate; text
  // pixels compared under the text tier (deltaE 2 / exceedPct 97), so the
  // browser gap is split into structural vs rasterization.
  if (c.width === fx.width && c.height === fx.height && c.rgba.length === fx.rgba.length) {
    const textMask = rectsToTextMask(c.width, c.height, c.fragments, MASK_PAD);
    const cmp = comparePixelBuffers({
      candidate: fx.rgba,
      reference: c.rgba,
      width: c.width,
      height: c.height,
      textMask,
      tolerance: TOL.screenshot,
    });
    console.log(
      `  screenshot: ${cmp.comparedPixels} non-text px compared, worst ΔE ${cmp.worstDeltaE.toFixed(2)}, mean ΔE ${cmp.meanDeltaE.toFixed(2)}, ${cmp.exceedingPixels} exceeding (${cmp.percentExceeding.toFixed(2)}%)` +
      (cmp.pass ? '' : '  [non-text FAIL]'),
    );
    console.log(
      `  screenshot text-region: ${cmp.textRegion.pixels} px, worst ΔE ${cmp.textRegion.worstDeltaE.toFixed(2)}, mean ΔE ${cmp.textRegion.meanDeltaE.toFixed(2)}, ${cmp.textRegion.exceedingPixels} exceeding (${cmp.textRegion.percentExceeding.toFixed(2)}%)` +
      (cmp.textRegion.pass ? '' : '  [text FAIL]'),
    );
  } else {
    console.log(`  screenshot: SKIPPED (size mismatch chrome ${c.width}x${c.height} vs firefox ${fx.width}x${fx.height})`);
  }
  console.log('');
}

await chromePage.close();
await ffPage.close();
await chrome.close();
await ff.close();
