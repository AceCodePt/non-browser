#!/usr/bin/env node
/**
 * `npm run verify:text-align`
 *
 * Renders every corpus/text-align fixture with the engine, harvests the Chrome
 * oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  (candidate engine vs Chrome canvas) within charter
 *     sub-pixel tolerances
 *   - layer-2 computedStyle  exact string equality (text-align computed values
 *     incl. the logical start/end keywords, matched verbatim)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension, PLUS the
 *     alignment-critical geometry: each text element's line fragments
 *     (Chrome Range.getClientRects() vs the engine's textFragments) compared
 *     on all four dims within the rect tolerance — centered/right/justified
 *     lines must land where Chrome puts them
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding; text
 *     pixels compared under the documented text tier (text-region mask)
 *
 * Writes reference.json/reference.png/text-mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes every
 * layer and every line fragment matches Chrome.
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

const corpus = resolve('corpus/text-align');

function* fixtures() {
  if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`verify:text-align: corpus directory missing: ${corpus}`);
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

function compareFragments(chromeFrags, engineFrags, maxPx) {
  let maxDelta = 0;
  let dims = 0;
  for (let k = 0; k < Math.max(chromeFrags.length, engineFrags.length); k++) {
    const c = chromeFrags[k];
    const e = engineFrags[k];
    if (!c || !e) return { pass: false, maxDelta: Number.POSITIVE_INFINITY, dims: 4 };
    for (const d of ['x', 'y', 'width', 'height']) {
      dims++;
      maxDelta = Math.max(maxDelta, Math.abs(c[d] - e[d]));
    }
  }
  return { pass: maxDelta <= maxPx, maxDelta, dims };
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];
const fragmentRows = [];
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

    // --- line-fragment comparison (the alignment-critical geometry) ---
    let fragPass = true;
    let fragDetail = 'no text elements';
    const textIds = h.textElements ?? [];
    if (textIds.length > 0) {
      const maxPx = tolerances.layers.rect.maxPx;
      let worst = 0;
      let totalDims = 0;
      let totalLines = 0;
      for (const id of textIds) {
        const c = fragmentsById[id] ?? [];
        const e = out.textFragments[id] ?? [];
        totalLines += Math.max(c.length, e.length);
        const cmp = compareFragments(c, e, maxPx);
        worst = Math.max(worst, cmp.maxDelta);
        totalDims += cmp.dims;
        if (!cmp.pass) fragPass = false;
      }
      fragDetail = `max Δ ${worst.toFixed(4)}px over ${totalLines} line fragment(s) (≤ ${maxPx}px)`;
      fragmentRows.push({ name, pass: fragPass, maxDelta: worst, lines: totalLines, detail: fragDetail });
      if (!fragPass) {
        allPass = false;
        failures.push(`fixture '${name}': fragment geometry — ${fragDetail}`);
      }
    }
    if (!evaluated.checkPass) {
      allPass = false;
      failures.push(`fixture '${name}': ${fragPass ? 'four-layer' : 'four-layer + fragment'} check failed`);
    }

    console.log(
      `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
        `fragments ${fragPass ? 'PASS' : 'FAIL'} (${fragDetail})` +
        (fragments.length > 0 ? `, ${textMask.reduce((a, b) => a + b, 0)} text px compared` : ''),
    );
  }
} finally {
  await browser.close();
}

if (results.length === 0) {
  console.error(`verify:text-align: no fixtures found under ${corpus}`);
  process.exit(1);
}

const report = buildReport(results, { fixtureSet: 'corpus/text-align', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
console.log('Line-fragment geometry (layer-3, per text element):');
for (const r of fragmentRows) {
  console.log(`  ${r.name}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
}
const ok = report.allChecksPass && fragmentRows.every((r) => r.pass);
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
if (!ok) {
  for (const f of failures) console.log(`      - ${f}`);
}
process.exit(ok ? 0 : 1);
