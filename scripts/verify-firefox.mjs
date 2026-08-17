#!/usr/bin/env node
/**
 * `npm run verify:firefox`
 *
 * Renders every corpus/firefox-track fixture with the engine under the
 * browser:'firefox' config (firefox font-registration set + firefox fallback
 * table) and diffs all four layers against headless Firefox (Playwright):
 *   - layer-1 measureText    candidate engine vs Firefox canvas, sub-pixel
 *   - layer-2 computedStyle  exact string equality
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot     per-pixel delta-E <= 2 with <= 1% pixels exceeding
 *
 * The engine shares the skia Canvas interface and the layout/paint pipeline
 * with the chrome path; only the browser-config differs (charter §4). Fixtures
 * in this corpus are authored against the firefox-registered faces, including
 * firefox-specific font-fallback fixtures whose unregistered families resolve
 * through the firefox fallback table to registered faces Gecko measures
 * identically. Text glyph pixels are compared under the documented text tier
 * (tolerances.json layers.screenshot.text, docs/ledgers/text-mask.md) — each
 * fixture reports its text-region pixels compared, mean/worst ΔE, and
 * text-pixel mask share. Only declared maskRects/maskElements stay masked
 * (mask.png).
 *
 * The engine's shipped text path is the Pretext breaker (the default), so the
 * engine's own line fragments are compared against Firefox's line boxes — the
 * engine path is what is verified, not a separate seam call (the same breaker
 * verify:four-layer asserts on the chrome path).
 *
 * Writes reference.json/reference.png/mask.png/text-mask.png (Firefox) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/firefox-track/. Exits 0 only when every fixture
 * passes every layer.
 */

import { firefox } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';
import { getUsePretextBreaker } from '../dist/layout/measure.js';
import { firefoxConfig } from '../dist/config/index.js';
import { setActiveBrowserConfig } from '../dist/config/browser-config.js';

const FONT_FILE = firefoxConfig.defaultFile;
const FONT_FAMILY = firefoxConfig.defaultFamily;

const corpus = resolve('corpus/firefox-track');

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
 * Text-region mask = every pixel inside Firefox's text fragment rects that
 * either rasterizer paints as anything other than pure white — glyph ink, the
 * AA fringe, and LCD/subpixel fringes that bleed past grayscale AA. These are
 * compared under the documented text tier (tolerances.json
 * layers.screenshot.text, justified by docs/ledgers/text-mask.md). Pure-white
 * pixels are not text and stay under the §10 band.
 */
function textRegionMask(width, height, rects, refData, candData) {
  const mask = new Uint8Array(width * height);
  const isWhite = (d, o) => d[o] === 255 && d[o + 1] === 255 && d[o + 2] === 255;
  for (const r of rects) {
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
 * Merge one element's fragments into per-line boxes: fragments sharing a line
 * (same y) are unioned into [x, width]. Gecko reports one rect per inline
 * text box, so a justified line may surface as several fragments; the union is
 * the honest per-line geometry both breakers must agree on.
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

const tolerances = loadTolerances(resolve('tolerances.json'));
setActiveBrowserConfig(firefoxConfig);
const browser = await firefox.launch();
const results = [];
const breakerResults = [];;

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:firefox: corpus directory missing: ${corpus}`);
  process.exit(1);
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

    const referenceComputed = {};
    if (h.computedStyle) {
      for (const { id, props } of h.computedStyle) {
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
    }

    // Firefox line fragments (used for the screenshot text mask and the engine
    // line-break parity check).
    const fragments = [];
    const fragmentsById = {};
    if (h.textElements && h.textElements.length > 0) {
      for (const id of h.textElements) {
        const info = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const range = document.createRange();
          range.selectNodeContents(el);
          const frags = [];
          for (const r of range.getClientRects()) {
            frags.push({ x: r.x, y: r.y, width: r.width, height: r.height });
          }
          return { frags };
        }, id);
        if (!info) continue;
        fragments.push(...info.frags);
        fragmentsById[id] = info.frags;
      }
    }

    const shot = await page.screenshot();
    const refImg = decodePng(shot);
    const { width, height } = refImg;
    await page.close();

    // --- engine candidate (browser:'firefox' config) ---
    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: FONT_FAMILY,
      fontFile: FONT_FILE,
      browserConfig: firefoxConfig,
      computedStyle: h.computedStyle,
      textElements: h.textElements,
    });
    const candImg = decodePng(out.rgba);

    const candidateRects = out.rects;
    const candidateMeasure = {};
    if (h.measureText) {
      const { measureTextWidth } = await import('../dist/layout/measure.js');
      for (const { text, font } of h.measureText) {
        const m = font.match(/^([\d.]+)px\s*['"]?([^'"]+)/);
        const size = m ? parseFloat(m[1]) : 14;
        const family = m ? m[2].trim() : FONT_FAMILY;
        candidateMeasure[`${font} | ${text}`] = measureTextWidth(text, size, family);
      }
    }

    // --- engine line fragments vs Firefox (the one breaker under test) ---
    // The engine's shipped text path is the Pretext breaker (asserted below),
    // so these fragments ARE the Pretext break decisions laid out by the
    // engine — there is no separate seam call anymore (docs/ledgers/breakers.md).
    let breakerPass = true;
    let breakerDetail = 'no text elements';
    if (!getUsePretextBreaker()) {
      breakerPass = false;
      breakerDetail = 'the engine is NOT running the Pretext breaker (CASCADE_BREAKER=greedy leaked into the run)';
    }
    const textIds = h.textElements ?? [];
    if (breakerPass && textIds.length > 0) {
      const maxPx = tolerances.layers.rect.maxPx;
      let worst = 0;
      let totalLines = 0;
      for (const id of textIds) {
        const ff = mergeLines(fragmentsById[id] ?? []);
        const engine = mergeLines((out.textFragments[id] ?? []).map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })));
        totalLines += Math.max(ff.length, engine.length);
        if (ff.length !== engine.length) {
          breakerPass = false;
          breakerDetail = `id ${id}: Firefox ${ff.length} lines vs engine ${engine.length}`;
          break;
        }
        for (let k = 0; k < ff.length; k++) {
          worst = Math.max(worst, Math.abs(ff[k].x - engine[k].x), Math.abs(ff[k].width - engine[k].width));
        }
      }
      if (breakerPass && totalLines > 0) {
        breakerPass = worst <= maxPx;
        breakerDetail = `max Δ ${worst.toFixed(4)}px over ${totalLines} line(s) (≤ ${maxPx}px)`;
      }
    }
    breakerResults.push({ name, pass: breakerPass, detail: breakerDetail });

    // --- text-region mask (fragments) and exclusion mask (declared
    // maskRects / maskElements only). Text pixels are NOT excluded any more:
    // they are compared under the documented text tier (tolerances.json
    // layers.screenshot.text, justified by docs/ledgers/text-mask.md). The
    // exclusion mask covers only what the engine cannot reproduce — every
    // masked pixel is justified per fixture.
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
      JSON.stringify(
        { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify(
        { measureText: candidateMeasure, computedStyle: out.computedStyles, rect: candidateRects },
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

    const textPixels = textMask.reduce((a, b) => a + b, 0);

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
      reference: { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects },
      candidate: { measureText: candidateMeasure, computedStyle: out.computedStyles, rect: candidateRects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    console.log(
      `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
        `${textPixels} text px compared, ${mask.reduce((a, b) => a + b, 0)} masked` +
        (h.textElements && fragments.length > 0 ? `, breaker ${breakerPass ? 'PASS' : 'FAIL'} (${breakerDetail})` : ''),
    );
  }
} finally {
  await browser.close();
}

const report = buildReport(results, { fixtureSet: 'corpus/firefox-track', tolerancesVersion: tolerances.version });
if (results.length === 0) {
  console.error(`verify:firefox: no fixtures found under ${corpus}`);
  process.exit(1);
}
const outDir = writeReport(report);
console.log(renderMarkdown(report));
if (breakerResults.length > 0) {
  const allBreaker = breakerResults.every((r) => r.pass);
  console.log(`Engine breaker (${breakerResults.length} fixtures): ${allBreaker ? 'PASS' : 'FAIL'}`);
  for (const r of breakerResults) {
    console.log(`  ${r.name}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
  }
}
const ok = report.allChecksPass && breakerResults.every((r) => r.pass);
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
