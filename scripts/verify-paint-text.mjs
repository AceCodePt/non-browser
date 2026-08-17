#!/usr/bin/env node
/**
 * `npm run verify:paint-text`
 *
 * Renders every corpus/paint-text fixture with the engine, harvests the Chrome
 * oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  (candidate engine vs Chrome canvas)
 *   - layer-2 computedStyle  (empty for these fixtures — out of scope, passes)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding
 *
 * Text glyph ink (and the text-decoration lines that sit inside the text
 * fragments) is compared under the documented text tier (tolerances.json
 * layers.screenshot.text, docs/ledgers/text-mask.md) — each fixture reports
 * its text-region pixels compared, mean/worst ΔE, and text-pixel mask share
 * (text-mask.png). The layout (line positions, sizes,
 * letter-spacing-driven wrapping) is verified by layer-3 and by the unmasked
 * pixels on layer-4. Only declared maskRects/maskElements (e.g. the Chrome
 * broken-image icon on <img>) stay masked (mask.png). The mixed-script
 * fixture's per-run painted advance positions are recorded in candidate.json
 * (paintRuns), summed against the shimmed widths by
 * scripts/verify-paint-fallback.mjs.
 *
 * Writes reference.json/reference.png/mask.png/text-mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes.
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';
import { getMeasurementCanvas } from '../dist/layout/measure.js';
import { resolveFallbackRuns, skiaCanvasFactory } from '../dist/canvas/index.js';
import { chromeConfig, getActiveBrowserConfig, setActiveBrowserConfig } from '../dist/config/index.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const corpus = resolve('corpus/paint-text');

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

/**
 * Text-region mask = every pixel inside Chrome's text fragment rects that
 * either rasterizer paints as anything other than pure white — glyph ink, the
 * AA fringe, and Chrome's LCD/subpixel fringes that bleed past grayscale AA.
 * These are the pixels compared under the documented text tier (tolerances.json
 * layers.screenshot.text, docs/ledgers/text-mask.md) instead of being excluded.
 * Pure-white pixels are not text and stay under the §10 band.
 */
function textRegionMask(width, height, fragments, refData, candData) {
  const mask = new Uint8Array(width * height);
  const isWhite = (d, o) => d[o] === 255 && d[o + 1] === 255 && d[o + 2] === 255;
  for (const r of fragments) {
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(width, Math.ceil(r.x + r.width));
    const y1 = Math.min(height, Math.ceil(r.y + r.height));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * width + x) * 4;
        if (!isWhite(refData, o) || !isWhite(candData, o)) mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

/**
 * Per-run painted advance positions for a string: the runs `drawText` paints
 * (shared run-resolution authority) at their accumulated x, measured against
 * the measurement seam. Recorded in candidate.json so a fixture's painted
 * advances are observable, and sum to the shimmed measureText width (gate:
 * scripts/verify-paint-fallback.mjs). Null when the string stays in the single
 * primary face (plain single-run paint).
 */
function paintRunsFor(text, font) {
  const config = getActiveBrowserConfig();
  const runs = resolveFallbackRuns(text, font, config, (family) => GlobalFonts.has(family));
  if (runs === null) return null;
  const measure = (t, f) => getMeasurementCanvas().measureText(t, f).width;
  let x = 0;
  return runs.map((r) => {
    const out = { text: r.text, font: r.font, x };
    x += measure(r.text, r.font);
    return out;
  });
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];

/**
 * The fixture's engine config: the chrome config's faces plus any faces the
 * fixture declares (`harvest.fonts`), so CSS families like 'Droid Arabic Kufi'
 * that chromeConfig's scriptFallback names but does not register resolve to
 * themselves instead of falling back to the default family.
 */
function engineConfigFor(raw) {
  if (raw.browser !== 'chrome') return null;
  const extra = (raw.fonts ?? []).map((f) => ({ family: f.family, filePath: f.file }));
  if (extra.length === 0) return chromeConfig;
  for (const f of extra) skiaCanvasFactory.registerFont(f.filePath, f.family);
  return { ...chromeConfig, fonts: [...chromeConfig.fonts, ...extra] };
}

try {
  for (const { dir, name, raw } of fixtures()) {
    const h = raw.harvest;
    const viewport = h.viewport;
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.setContent(h.html);
    await page.evaluate(() => document.fonts.ready);

    const referenceRects = {};
    for (const id of h.rects ?? []) {
      referenceRects[id] = await page.$eval(`#${id}`, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
    }

    const referenceMeasure = {};
    if (h.measureText) {
      for (const { text, font } of h.measureText) {
        referenceMeasure[`${font} | ${text}`] = await page.evaluate(
          ({ text, font }) => {
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.font = font;
            return ctx.measureText(text).width;
          },
          { text, font },
        );
      }
    }

    const fragments = [];
    if (h.textElements && h.textElements.length > 0) {
      for (const id of h.textElements) {
        const frags = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return [];
          const range = document.createRange();
          range.selectNodeContents(el);
          const out = [];
          for (const r of range.getClientRects()) {
            out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
          }
          return out;
        }, id);
        fragments.push(...frags);
      }
    }

    const shot = await page.screenshot();
    const refImg = decodePng(shot);
    const { width, height } = refImg;
    await page.close();

    // A fixture naming a browser target renders with that config's registered
    // faces (chrome registers the per-script fallback set), so run-splitting
    // resolves the same faces the oracle's fontconfig resolves.
    const config = engineConfigFor(raw);
    if (config) setActiveBrowserConfig(config);
    const fontFile = config ? config.defaultFile : FONT_FILE;
    const fontFamily = config ? config.defaultFamily : FONT_FAMILY;
    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily,
      fontFile,
      ...(config ? { browserConfig: config } : {}),
    });
    const candImg = decodePng(out.rgba);

    const candidateRects = out.rects;
    const candidateMeasure = {};
    const paintRuns = {};
    if (h.measureText) {
      const { measureTextWidth } = await import('../dist/layout/measure.js');
      for (const { text, font } of h.measureText) {
        const m = font.match(/^([\d.]+)px\s*['"]?([^'"]+)/);
        const size = m ? parseFloat(m[1]) : 14;
        const family = m ? m[2].trim() : fontFamily;
        const key = `${font} | ${text}`;
        candidateMeasure[key] = measureTextWidth(text, size, family);
        const runs = paintRunsFor(text, font);
        if (runs !== null) paintRuns[key] = runs;
      }
    }

    // --- text-region mask (fragments) and exclusion mask (declared
    // maskRects / maskElements only). Text pixels are NOT excluded any more:
    // they are compared under the documented text tier (tolerances.json
    // layers.screenshot.text, justified by docs/ledgers/text-mask.md). The
    // exclusion mask covers only what the engine cannot reproduce (e.g. the
    // Chrome broken-image icon on <img>) — every masked pixel is justified per
    // fixture.
    const textMask = textRegionMask(width, height, fragments, refImg.data, candImg.data);
    const mask = new Uint8Array(width * height);
    for (const r of h.maskRects ?? []) {
      const x0 = Math.max(0, Math.floor(r.x));
      const y0 = Math.max(0, Math.floor(r.y));
      const x1 = Math.min(width, Math.ceil(r.x + r.width));
      const y1 = Math.min(height, Math.ceil(r.y + r.height));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) mask[y * width + x] = 1;
      }
    }
    // Replaced elements whose Chrome placeholder can't be reproduced by the
    // engine (e.g. the broken-image icon on <img>) are masked by border box.
    for (const id of h.maskElements ?? []) {
      const r = referenceRects[id];
      if (!r) throw new Error(`fixture ${name}: maskElements '${id}' has no rect`);
      const x0 = Math.max(0, Math.floor(r.x));
      const y0 = Math.max(0, Math.floor(r.y));
      const x1 = Math.min(width, Math.ceil(r.x + r.width));
      const y1 = Math.min(height, Math.ceil(r.y + r.height));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) mask[y * width + x] = 1;
      }
    }

    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify({ measureText: referenceMeasure, computedStyle: {}, rect: referenceRects }, null, 2) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify(
        { measureText: candidateMeasure, computedStyle: {}, rect: candidateRects, ...(Object.keys(paintRuns).length > 0 ? { paintRuns } : {}) },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(join(dir, 'reference.png'), shot);
    writeFileSync(join(dir, 'candidate.png'), encodePng(candImg.width, candImg.height, candImg.data));
    const writeMaskPng = (file, m) => {
      const rgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) if (m[i] === 1) rgba[i * 4 + 3] = 255;
      writeFileSync(join(dir, file), encodePng(width, height, rgba));
    };
    if (mask.some((b) => b === 1)) writeMaskPng('mask.png', mask);
    if (textMask.some((b) => b === 1)) writeMaskPng('text-mask.png', textMask);

    const fixture = {
      name,
      note: raw.note,
      expected: raw.expected ?? {
        measureText: 'pass',
        computedStyle: 'pass',
        rect: 'pass',
        screenshot: 'pass',
      },
      tolerances,
      referenceRgba: refImg.data,
      candidateRgba: candImg.data,
      mask,
      textMask,
      reference: { measureText: referenceMeasure, computedStyle: {}, rect: referenceRects },
      candidate: { measureText: candidateMeasure, computedStyle: {}, rect: candidateRects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    const textPixels = textMask.reduce((a, b) => a + b, 0);
    const maskPixels = mask.reduce((a, b) => a + b, 0);
    console.log(
      `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
        `${textPixels} text px compared, ${maskPixels} masked`,
    );
  }
} finally {
  await browser.close();
}

const report = buildReport(results, { fixtureSet: 'corpus/paint-text', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
