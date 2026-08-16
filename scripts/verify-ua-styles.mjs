#!/usr/bin/env node
/**
 * `npm run verify:ua-styles`
 *
 * Renders every corpus/ua-styles fixture with the engine's UA stylesheet
 * (src/cascade/ua.ts) and diffs all four layers against headless Chrome:
 *   - layer-1 measureText    candidate engine vs Chrome canvas, sub-pixel
 *   - layer-2 computedStyle  exact string equality (h1 font-size/margins etc.)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot     per-pixel delta-E <= 2 with <= 1% pixels exceeding
 *
 * The fixtures are bare HTML (headings, paragraphs, lists, strong/em/pre/hr)
 * with no author styles: every computed value comes from the UA layer, so this
 * proves the UA stylesheet matches Chrome for the same markup.
 *
 * Writes reference.json/reference.png/mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes every
 * layer.
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';
import { chromeConfig } from '../dist/config/index.js';

const corpus = resolve('corpus/ua-styles');

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

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

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:ua-styles: corpus directory missing: ${corpus}`);
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

    // --- engine candidate (chrome browser-config so generic families and
    // weight/style faces resolve like Chrome's fontconfig) ---
    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: chromeConfig.defaultFamily,
      fontFile: chromeConfig.defaultFile,
      browserConfig: chromeConfig,
      computedStyle: h.computedStyle,
    });
    const candImg = decodePng(out.rgba);

    const candidateRects = out.rects;
    const candidateMeasure = {};
    if (h.measureText) {
      const { measureTextWidth } = await import('../dist/layout/measure.js');
      for (const { text, font } of h.measureText) {
        const m = font.match(/^([\d.]+)px\s*['"]?([^'"]+)/);
        const size = m ? parseFloat(m[1]) : 14;
        const family = m ? m[2].trim() : chromeConfig.defaultFamily;
        candidateMeasure[`${font} | ${text}`] = measureTextWidth(text, size, family);
      }
    }

    const textMask = textRegionMask(width, height, fragments, refImg.data, candImg.data);
    const mask = new Uint8Array(width * height);

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
    if (textMask.some((b) => b === 1)) {
      const rgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) if (textMask[i] === 1) rgba[i * 4 + 3] = 255;
      writeFileSync(join(dir, 'text-mask.png'), encodePng(width, height, rgba));
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
      textMask,
      reference: { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects },
      candidate: { measureText: candidateMeasure, computedStyle: out.computedStyles, rect: candidateRects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    console.log(
      `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
        `${textMask.reduce((a, b) => a + b, 0)} text px compared`,
    );
  }
} finally {
  await browser.close();
}

const report = buildReport(results, { fixtureSet: 'corpus/ua-styles', tolerancesVersion: tolerances.version });
if (results.length === 0) {
  console.error(`verify:ua-styles: no fixtures found under ${corpus}`);
  process.exit(1);
}
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
