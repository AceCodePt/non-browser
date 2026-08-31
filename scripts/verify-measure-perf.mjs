#!/usr/bin/env node
/**
 * `npm run verify:measure-perf`
 *
 * The text-measurement perf gate (task measure-fastpath-cache): asserts the two
 * numbers the task pins, measured in this repo:
 *
 *   - mean measureTextWidth over 100 calls of a covered Latin sentence <
 *     0.05ms/call (baseline ~0.33ms — the per-grapheme script-run resolution
 *     the single-face fast path skips). Two readings are asserted:
 *       * warm: 100 calls of one sentence — the Pretext break-candidate
 *         re-measure case the width memo serves;
 *       * fastpath: 100 calls cycling 10 distinct sentences — the width memo
 *         rarely hits (each sentence recurs every 10 calls) so these reads are
 *         the single-face fast path plus the per-family probe memo, exactly
 *         the steady state inside one render after its first measurements.
 *   - rectsOf kitchen-sink @320x568 mean over 5 renders < 60ms (baseline
 *     ~143ms, of which ~128ms was text measurement — no longer the dominant
 *     layout cost).
 *
 * Exits 0 only when both pass. Widths are not compared here — byte-exact
 * parity is the verify:text-measure / four-layer / stress / rect-contract /
 * firefox gates' contract, which this gate must not trade for speed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { skiaCanvasFactory } from '../dist/canvas/index.js';
import { initMeasurement, measureTextWidth } from '../dist/layout/measure.js';
import { rectsOf } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const MEASURE_CALLS = 100;
const MEASURE_MAX_MS = 0.05;
const RENDER_ITERS = 5;
const RENDER_MAX_MS = 60;

skiaCanvasFactory.registerFont(FONT_FILE, FONT_FAMILY);
initMeasurement({ family: FONT_FAMILY, filePath: FONT_FILE }, skiaCanvasFactory);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const sentence = 'The quick brown fox jumps over the lazy dog. Packed full of ordinary body copy for the single-face fast path.';
const sentences = [
  'The quick brown fox jumps over the lazy dog.',
  'All human beings are born free and equal in dignity and rights.',
  'To be or not to be, that is the question.',
  'The only thing we have to fear is fear itself.',
  'In the beginning God created the heaven and the earth.',
  'It was the best of times, it was the worst of times.',
  'I have a dream that one day this nation will rise up.',
  'Four score and seven years ago our fathers brought forth.',
  'Do not go gentle into that good night.',
  'A journey of a thousand miles begins with a single step.',
];

measureTextWidth(sentence, 16, FONT_FAMILY);
const warmTimes = [];
for (let i = 0; i < MEASURE_CALLS; i++) {
  const t = performance.now();
  measureTextWidth(sentence, 16, FONT_FAMILY);
  warmTimes.push(performance.now() - t);
}
const warmMs = mean(warmTimes);

// Cycling distinct sentences: the width memo misses most of the time, so these
// reads carry the fast path (only the per-family probe memo stays warm, as it
// does inside a render after its first measurements).
const fastTimes = [];
for (let i = 0; i < MEASURE_CALLS; i++) {
  const s = sentences[i % sentences.length];
  const t = performance.now();
  measureTextWidth(s, 16, FONT_FAMILY);
  fastTimes.push(performance.now() - t);
}
const fastMs = mean(fastTimes);

const kitchen = JSON.parse(readFileSync(resolve('corpus/stress/kitchen-sink/fixture.json'), 'utf8'));
const opts = { width: 320, height: 568, fontFamily: FONT_FAMILY, fontFile: FONT_FILE };
rectsOf(kitchen.harvest.html, opts);
const renderTimes = [];
for (let i = 0; i < RENDER_ITERS; i++) {
  const t = performance.now();
  rectsOf(kitchen.harvest.html, opts);
  renderTimes.push(performance.now() - t);
}
const renderMs = mean(renderTimes);

const pass = warmMs < MEASURE_MAX_MS && fastMs < MEASURE_MAX_MS && renderMs < RENDER_MAX_MS;

console.log(
  `verify:measure-perf: measureTextWidth warm ${warmMs.toFixed(4)}ms/call (< ${MEASURE_MAX_MS}ms) ` +
    `fastpath ${fastMs.toFixed(4)}ms/call (< ${MEASURE_MAX_MS}ms) | ` +
    `kitchen-sink@320x568 rectsOf ${renderMs.toFixed(1)}ms mean over ${RENDER_ITERS} (< ${RENDER_MAX_MS}ms)`,
);
if (!pass) {
  console.error('verify:measure-perf: FAIL — see thresholds above');
  process.exit(1);
}
console.log('verify:measure-perf: PASS');
process.exit(0);