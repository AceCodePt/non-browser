#!/usr/bin/env node
/**
 * Acceptance gate for the paint-run-fallback task, run by the daemon's
 * session-idle hook for *paint-run-fallback* task names.
 *
 * Why this exists: `npm run verify` stays green on unchanged code (the typed
 * known-gaps fixtures assert their divergences STILL exist, so a no-op agent
 * passes the default hook). A task whose acceptance is only `npm run verify`
 * can therefore be archived without doing its work. This gate makes the
 * acceptance check the task's actual requirements instead.
 *
 * Exits 0 only when:
 *   1. the compiled skia canvas routes BOTH `measureText` and `drawText`
 *      through the same run-resolution authority (`resolveFallbackRuns`), and
 *      the measurement shim (`measureTextWithFallback`) delegates to it too —
 *      one authority shared by measure and paint, not two copies;
 *   2. for a set of mixed-script strings the per-run faces resolve as
 *      Chrome's fontconfig does (Latin primary, Han -> Droid Sans Fallback,
 *      emoji -> Noto Color Emoji, missing Latin on a CJK primary ->
 *      Liberation Serif), and the per-run painted advances (each run at its
 *      accumulated advance) sum to the shimmed measureText width;
 *   3. a single-face string still resolves to a single run (null), so paint
 *      keeps its plain single-face path — no regression for covered text.
 *
 * The painted-advance parity is then proven per fixture by
 * `npm run verify:paint-text` (the mixed-script fixture records its per-run
 * painted advance positions and compares its screenshot under the text tier).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { skiaCanvasFactory, resolveFallbackRuns } from '../dist/canvas/index.js';
import { chromeConfig, setActiveBrowserConfig } from '../dist/config/index.js';

const EPS = 1e-3;

function fail(msg) {
  console.error(`verify-paint-fallback: FAIL — ${msg}`);
  process.exit(1);
}

// --- 1. structural: measure and paint route through one run-resolution authority ---
const skiaSrc = readFileSync(resolve('dist/canvas/skia.js'), 'utf8');
const fallbackSrc = readFileSync(resolve('dist/canvas/script-fallback.js'), 'utf8');

/** Extract a compiled method body (from its opening `{` to the matching `}`). */
function methodBody(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) return null;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

const measureBody = methodBody(skiaSrc, 'measureText(text, font)');
const drawBody = methodBody(skiaSrc, 'drawText(text, x, baselineY, font, color)');
if (measureBody === null) fail('compiled SkiaCanvas.measureText method body not found in dist/canvas/skia.js');
if (drawBody === null) fail('compiled SkiaCanvas.drawText method body not found in dist/canvas/skia.js');
// measureText routes through the measurement shim, which delegates run
// resolution to resolveFallbackRuns below; drawText routes to it directly.
if (!measureBody.includes('measureTextWithFallback'))
  fail('SkiaCanvas.measureText does not route through the measurement shim (measure/paint run-resolution authority diverged)');
if (!drawBody.includes('resolveFallbackRuns'))
  fail('SkiaCanvas.drawText does not route through resolveFallbackRuns (paint forked the script-run logic)');

const shimBody = methodBody(fallbackSrc, 'measureTextWithFallback(text, font, config, measure, hasFamily)');
if (shimBody === null) fail('compiled measureTextWithFallback body not found in dist/canvas/script-fallback.js');
if (!shimBody.includes('resolveFallbackRuns'))
  fail('measureTextWithFallback does not delegate to resolveFallbackRuns (two run-resolution copies exist)');

// --- 2+3. functional: per-run faces + painted advances sum to the shimmed width ---
setActiveBrowserConfig(chromeConfig);
for (const f of chromeConfig.fonts) {
  try {
    skiaCanvasFactory.registerFont(f.filePath, f.family);
  } catch {
    fail(`cannot register configured face '${f.family}' from ${f.filePath}`);
  }
}
const canvas = skiaCanvasFactory.create(1, 1);
const hasFamily = (family) => GlobalFonts.has(family);
const familyOf = (fontShorthand) => fontShorthand.replace(/^.*?[\d.]+px\s*'/, '').replace(/'$/, '');

// Text, font, and the per-run family Chrome's fontconfig resolves (measured
// against the oracle; the fixture strings also live in corpus/paint-text/mixed-script).
const cases = [
  {
    text: 'abc 中文 😀 def',
    font: "16px 'Noto Sans'",
    families: ['Noto Sans', 'Droid Sans Fallback', 'Noto Sans', 'Noto Color Emoji', 'Noto Sans'],
  },
  {
    text: 'مرحبا! هل أنت بخير؟',
    font: "16px 'Droid Arabic Kufi'",
    families: ['Droid Arabic Kufi', 'Liberation Serif', 'Droid Arabic Kufi'],
  },
  {
    text: 'mixed 中文 text テスト',
    font: "16px 'Droid Sans Fallback'",
    families: ['Liberation Serif', 'Droid Sans Fallback', 'Liberation Serif', 'Droid Sans Fallback'],
  },
];

for (const c of cases) {
  const runs = resolveFallbackRuns(c.text, c.font, chromeConfig, hasFamily);
  if (runs === null) fail(`${JSON.stringify(c.text)} resolved to a single face but the shim should split it`);
  if (runs.length < 2) fail(`${JSON.stringify(c.text)} resolved to ${runs.length} run(s); expected per-script splitting`);
  if (runs.length !== c.families.length)
    fail(`${JSON.stringify(c.text)} resolved to ${runs.length} runs, expected ${c.families.length}`);

  const gotFamilies = runs.map((r) => familyOf(r.font));
  for (let i = 0; i < c.families.length; i++) {
    if (gotFamilies[i] !== c.families[i])
      fail(`${JSON.stringify(c.text)} run ${i} paints with '${gotFamilies[i]}', expected '${c.families[i]}'`);
  }

  // Each run is painted at its accumulated advance, so the last painted x plus
  // its width lands exactly on the shimmed measureText width.
  const shimmed = canvas.measureText(c.text, c.font).width;
  let advance = 0;
  for (const run of runs) {
    const w = canvas.measureText(run.text, run.font).width;
    advance += w;
  }
  if (Math.abs(advance - shimmed) > EPS)
    fail(`${JSON.stringify(c.text)}: painted run advances sum to ${advance.toFixed(4)}px but shimmed width is ${shimmed.toFixed(4)}px`);
}

const single = 'plain latin only';
if (resolveFallbackRuns(single, "16px 'Noto Sans'", chromeConfig, hasFamily) !== null)
  fail(`single-face string ${JSON.stringify(single)} must stay on the plain single-face paint path`);

console.log('verify-paint-fallback: PASS — measure and paint share resolveFallbackRuns; per-run painted advances sum to the shimmed width');
