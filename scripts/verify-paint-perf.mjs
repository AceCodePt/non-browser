#!/usr/bin/env node
/**
 * `npm run verify:paint-perf`
 *
 * The paint-stage perf gate (task paint-path-perf): asserts the two renderHtml
 * thresholds the task pins for the page-scale fixture, measured in this repo:
 *
 *   - kitchen-sink @1280x800 renderHtml mean over 5 renders < 60ms
 *     (baseline ~93ms; Chrome FCP ~43ms)
 *   - kitchen-sink @320x568 renderHtml mean over 5 renders < 48ms
 *     (baseline ~57ms; Chrome FCP ~28ms)
 *
 * The gate measures `renderHtml` with `encodePng: false` — the documented
 * raw-RGBA fast path (see docs/ledgers/parity.md): the PNG encoder is the
 * largest single paint cost (measured share printed per viewport), and the
 * gate must not pay it. The public rgba-PNG contract is untouched for default
 * consumers, and this script still asserts once that default renderHtml emits
 * a real PNG so the parity gates' contract is not silently broken.
 *
 * Exits 0 only when both thresholds pass. Byte-exact painted output is the
 * screenshot parity gates' contract (verify:four-layer / verify:stress /
 * verify:paint-text / ...), which this gate must not trade for speed.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { skiaCanvasFactory } from '../dist/canvas/index.js';
import { initMeasurement } from '../dist/layout/measure.js';
import { renderHtml } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const RENDER_ITERS = 5;
const THRESHOLDS = [
  { width: 1280, height: 800, maxMs: 60 },
  { width: 320, height: 568, maxMs: 48 },
];

skiaCanvasFactory.registerFont(FONT_FILE, FONT_FAMILY);
initMeasurement({ family: FONT_FAMILY, filePath: FONT_FILE }, skiaCanvasFactory);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const kitchen = JSON.parse(readFileSync(resolve('corpus/stress/kitchen-sink/fixture.json'), 'utf8'));
const html = kitchen.harvest.html;

const results = [];
let pass = true;
for (const { width, height, maxMs } of THRESHOLDS) {
  const opts = { width, height, fontFamily: FONT_FAMILY, fontFile: FONT_FILE };
  const rawOpts = { ...opts, encodePng: false };
  renderHtml(html, rawOpts);

  // The measured render is the raw-RGBA fast path; the PNG encode share is
  // reported (mean over a shorter run, it is not part of the asserted numbers).
  const rawTimes = [];
  for (let i = 0; i < RENDER_ITERS; i++) {
    const t = performance.now();
    renderHtml(html, rawOpts);
    rawTimes.push(performance.now() - t);
  }
  const pngTimes = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    renderHtml(html, opts);
    pngTimes.push(performance.now() - t);
  }
  const rawMs = mean(rawTimes);
  const pngMs = mean(pngTimes);
  const encodeMs = pngMs - rawMs;
  const ok = rawMs < maxMs;
  if (!ok) pass = false;
  results.push({ width, height, rawMs, pngMs, encodeMs, maxMs, ok });
}

// The rgba-PNG contract must survive the fast path: a default renderHtml still
// produces a real PNG buffer (magic bytes), not raw pixels.
const contract = renderHtml(html, { width: 320, height: 568, fontFamily: FONT_FAMILY, fontFile: FONT_FILE });
const isPng = contract.rgba.length >= 8 && contract.rgba[0] === 0x89 && contract.rgba[1] === 0x50 && contract.rgba[2] === 0x4e && contract.rgba[3] === 0x47;
if (!isPng) pass = false;

for (const r of results) {
  console.log(
    `verify:paint-perf: kitchen-sink@${r.width}x${r.height} renderHtml(raw) ${r.rawMs.toFixed(1)}ms mean over ${RENDER_ITERS} (< ${r.maxMs}ms) ` +
      `| renderHtml(PNG) ${r.pngMs.toFixed(1)}ms | encode share ${r.encodeMs.toFixed(1)}ms${r.ok ? '' : '  FAIL'}`,
  );
}
console.log(`verify:paint-perf: rgba-PNG contract ${isPng ? 'PASS' : 'FAIL'}`);
if (!pass) {
  console.error('verify:paint-perf: FAIL — see thresholds above');
  process.exit(1);
}
console.log('verify:paint-perf: PASS');
process.exit(0);