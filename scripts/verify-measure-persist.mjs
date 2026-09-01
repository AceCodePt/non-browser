#!/usr/bin/env node
/**
 * `npm run verify:measure-persist`
 *
 * The cache-persistence gate (task measure-cache-persist): proves the measure
 * memo survives repeated renders of the same HTML with the same config and
 * fonts in one process — the invalidation paths in setActiveBrowserConfig and
 * registerFont now fire only on a genuine change, so a repeated render no
 * longer wipes the memo at the start of every prepare(). Asserts the two
 * numbers the task pins, measured in this repo:
 *
 *   - rectsOf corpus/stress/kitchen-sink @320x568 mean over 5 renders after
 *     one warmup render < 27ms (baseline ~31-37ms, of which ~12.4ms was the
 *     wiped-memo re-measurement of ~727 canvas measureText calls per render).
 *   - canvas measureText calls during those timed warm renders < 100 each
 *     (each call is a width-memo miss; the per-render count is read via
 *     getMeasureCacheMisses).
 *
 * The warmup render fills the memo with the ~700-string working set; the
 * timed renders must then hit it almost entirely. Exits 0 only when both pass.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { rectsOf } from '../dist/layout/render.js';
import { getMeasureCacheMisses, resetMeasureCacheMisses } from '../dist/canvas/measure-cache.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const RENDER_ITERS = 5;
const RENDER_MAX_MS = 27;
const MISS_MAX = 100;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const kitchen = JSON.parse(readFileSync(resolve('corpus/stress/kitchen-sink/fixture.json'), 'utf8'));
const opts = { width: 320, height: 568, fontFamily: FONT_FAMILY, fontFile: FONT_FILE };
rectsOf(kitchen.harvest.html, opts);

const renderTimes = [];
const missCounts = [];
for (let i = 0; i < RENDER_ITERS; i++) {
  resetMeasureCacheMisses();
  const t = performance.now();
  rectsOf(kitchen.harvest.html, opts);
  renderTimes.push(performance.now() - t);
  missCounts.push(getMeasureCacheMisses());
}
const renderMs = mean(renderTimes);
const worstMisses = Math.max(...missCounts);

const pass = renderMs < RENDER_MAX_MS && missCounts.every((c) => c < MISS_MAX);

console.log(
  `verify:measure-persist: kitchen-sink@320x568 rectsOf ${renderMs.toFixed(1)}ms mean over ${RENDER_ITERS} warm renders (< ${RENDER_MAX_MS}ms) ` +
    `| canvas measureText calls per timed render ${missCounts.join(', ')} (worst ${worstMisses} < ${MISS_MAX})`,
);
if (!pass) {
  console.error('verify:measure-persist: FAIL — the measure memo did not persist across repeated renders (see thresholds above)');
  process.exit(1);
}
console.log('verify:measure-persist: PASS');
process.exit(0);