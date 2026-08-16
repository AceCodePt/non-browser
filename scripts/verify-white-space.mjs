#!/usr/bin/env node
/**
 * `npm run verify:white-space`
 *
 * Renders every corpus/white-space fixture with the engine, harvests the Chrome
 * oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  within the charter sub-pixel tolerances
 *   - layer-2 computedStyle  exact string equality (white-space computed
 *     values for every value the engine parses, incl. inheritance)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension, PLUS the
 *     white-space-critical geometry: each text element's line boxes are
 *     compared against Chrome's Range.getClientRects() on x and width within
 *     the rect tolerance. Chrome splits a line into several fragments (newline
 *     boxes, hung spaces, preserved leading-space runs), so each side's
 *     fragments are merged per line (same y) into one [x, width] union before
 *     comparison — the number of lines and their union widths must match.
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding; text
 *     pixels compared under the documented text tier (text-region mask)
 *
 * Writes reference.json/reference.png/text-mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes every
 * layer and every line box matches Chrome.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const corpus = resolve('corpus/white-space');

function* fixtures() {
  if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`verify:white-space: corpus directory missing: ${corpus}`);
    process.exit(1);
  }
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
 * These pixels are compared under the documented text tier (tolerances.json
 * layers.screenshot.text), justified by docs/ledgers/text-mask.md.
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
 * (same y) are unioned into [x, width]. Chrome reports one rect per inline
 * text box — a line may surface as several fragments (a zero-width box per
 * newline, a hung space after a pre-wrap wrap point, a preserved leading-space
 * run) — so the union is the honest per-line geometry both engines must agree
 * on.
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

function compareLines(chromeLines, engineLines, maxPx) {
  if (chromeLines.length !== engineLines.length) {
    return { pass: false, maxDelta: Number.POSITIVE_INFINITY, lines: Math.max(chromeLines.length, engineLines.length) };
  }
  let maxDelta = 0;
  for (let k = 0; k < chromeLines.length; k++) {
    const c = chromeLines[k];
    const e = engineLines[k];
    maxDelta = Math.max(maxDelta, Math.abs(c.x - e.x), Math.abs(c.width - e.width));
  }
  return { pass: maxDelta <= maxPx, maxDelta, lines: chromeLines.length };
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];
const lineRows = [];
let allPass = true;
const failures = [];

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

    const fragments = [];
    const fragmentsById = {};
    if (h.textElements && h.textElements.length > 0) {
      for (const id of h.textElements) {
        const frags = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return [];
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
        }, id);
        fragmentsById[id] = frags;
        fragments.push(...frags);
      }
    }

    const shot = await page.screenshot();
    const refImg = decodePng(shot);
    const { width, height } = refImg;
    await page.close();

    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: FONT_FAMILY,
      fontFile: FONT_FILE,
      computedStyle: h.computedStyle,
      textElements: h.textElements,
    });
    const candImg = decodePng(out.rgba);

    const candidateRects = out.rects;
    const candidateComputed = out.computedStyles;
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
        { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects, fragments: fragmentsById },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify(
        { measureText: candidateMeasure, computedStyle: candidateComputed, rect: candidateRects, fragments: out.textFragments },
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
      reference: { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects },
      candidate: { measureText: candidateMeasure, computedStyle: candidateComputed, rect: candidateRects },
      width,
      height,
    };
    const evaluated = evaluateFixture(fixture);
    results.push(evaluated);

    // --- line-box comparison (the white-space-critical geometry) ---
    let linePass = true;
    let lineDetail = 'no text elements';
    const textIds = h.textElements ?? [];
    if (textIds.length > 0) {
      const maxPx = tolerances.layers.rect.maxPx;
      let worst = 0;
      let totalLines = 0;
      for (const id of textIds) {
        const chrome = mergeLines(fragmentsById[id] ?? []);
        const engine = mergeLines((out.textFragments[id] ?? []).map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })));
        totalLines += Math.max(chrome.length, engine.length);
        const cmp = compareLines(chrome, engine, maxPx);
        worst = Math.max(worst, cmp.maxDelta);
        if (!cmp.pass) linePass = false;
      }
      lineDetail = `max Δ ${worst === Number.POSITIVE_INFINITY ? '∞' : worst.toFixed(4)}px over ${totalLines} line box(es) (≤ ${maxPx}px)`;
      lineRows.push({ name, pass: linePass, maxDelta: worst, lines: totalLines, detail: lineDetail });
      if (!linePass) {
        allPass = false;
        failures.push(`fixture '${name}': line-box geometry — ${lineDetail}`);
      }
    }
    if (!evaluated.checkPass) {
      allPass = false;
      failures.push(`fixture '${name}': ${linePass ? 'four-layer' : 'four-layer + line-box'} check failed`);
    }

    console.log(
      `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
        `lines ${linePass ? 'PASS' : 'FAIL'} (${lineDetail})` +
        (fragments.length > 0 ? `, ${textMask.reduce((a, b) => a + b, 0)} text px compared` : ''),
    );
  }
} finally {
  await browser.close();
}

if (results.length === 0) {
  console.error(`verify:white-space: no fixtures found under ${corpus}`);
  process.exit(1);
}

const report = buildReport(results, { fixtureSet: 'corpus/white-space', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
console.log('Line-box geometry (layer-3, per text element):');
for (const r of lineRows) {
  console.log(`  ${r.name}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
}
const ok = report.allChecksPass && lineRows.every((r) => r.pass);
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
if (!ok) {
  for (const f of failures) console.log(`      - ${f}`);
}
process.exit(ok ? 0 : 1);
