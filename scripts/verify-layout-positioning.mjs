#!/usr/bin/env node
/**
 * `npm run verify:layout-positioning`
 *
 * Renders every corpus/positioning fixture with the engine, harvests the
 * Chrome oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  (candidate engine vs Chrome canvas)
 *   - layer-2 computedStyle  (empty for these fixtures — out of scope, passes)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding
 *
 * Text glyph pixels are masked (mask.png) exactly as in the floats/grid
 * corpora; positioned geometry (offsets, containing blocks, static positions,
 * auto-margin centering) is verified pixel-exactly by layer-3 and by the
 * unmasked box pixels on layer-4, and the z-index stacking order is verified
 * by layer-4's painted pixels.
 *
 * Writes reference.json/reference.png/mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes.
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
/** px to expand text-fragment rects when building the screenshot mask. */
const MASK_PAD = 2;

const corpus = resolve('corpus/positioning');

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

/** Build the exclusion mask (1 = excluded) from Chrome's text fragment rects. */
function buildMask(width, height, fragments, pad) {
  const mask = new Uint8Array(width * height);
  for (const f of fragments) {
    const x0 = Math.max(0, Math.floor(f.x) - pad);
    const y0 = Math.max(0, Math.floor(f.y) - pad);
    const x1 = Math.min(width, Math.ceil(f.x + f.width) + pad);
    const y1 = Math.min(height, Math.ceil(f.y + f.height) + pad);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];

try {
  for (const { dir, name, raw } of fixtures()) {
    const h = raw.harvest;
    const viewport = h.viewport;
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.setContent(h.html);
    await page.evaluate(() => document.fonts.ready);

    // --- Chrome oracle quantities ---
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

    // --- engine candidate ---
    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: FONT_FAMILY,
      fontFile: FONT_FILE,
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

    const mask = buildMask(width, height, fragments, MASK_PAD);

    // Persist the corpus golden data.
    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify({ measureText: referenceMeasure, computedStyle: {}, rect: referenceRects }, null, 2) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify({ measureText: candidateMeasure, computedStyle: {}, rect: candidateRects }, null, 2) + '\n',
    );
    writeFileSync(join(dir, 'reference.png'), shot);
    writeFileSync(join(dir, 'candidate.png'), encodePng(candImg.width, candImg.height, candImg.data));
    if (mask.some((b) => b === 1)) {
      const rgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) if (mask[i] === 1) rgba[i * 4 + 3] = 255;
      writeFileSync(join(dir, 'mask.png'), encodePng(width, height, rgba));
    }

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
      reference: { measureText: referenceMeasure, computedStyle: {}, rect: referenceRects },
      candidate: { measureText: candidateMeasure, computedStyle: {}, rect: candidateRects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    console.log(`verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ${mask.some((b) => b === 1) ? 'masked' : 'no mask'}`);
  }
} finally {
  await browser.close();
}

mkdirSync(corpus, { recursive: true });
const report = buildReport(results, { fixtureSet: 'corpus/positioning', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
