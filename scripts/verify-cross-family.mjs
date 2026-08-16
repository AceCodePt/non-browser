#!/usr/bin/env node
/**
 * `npm run verify:cross-family`
 *
 * Renders every corpus/cross-family fixture with the engine under the fixture's
 * declared browser config (chromeConfig or firefoxConfig) and diffs all four
 * layers against the matching headless browser oracle (Chromium or Firefox):
 *   - layer-1 measureText    candidate engine vs browser canvas, sub-pixel
 *   - layer-2 computedStyle  exact string equality
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot     per-pixel delta-E <= 2 with <= 1% pixels exceeding
 *
 * Each fixture declares which browser it targets (`fixture.browser`), so this
 * one script exercises BOTH browser-configs' fallback tables:
 *   - chrome-config fixtures resolve CSS font stacks through chrome.ts's
 *     fallback table (e.g. `Times New Roman` -> Liberation Serif) at LAYOUT
 *     time — the fixture text wraps with the resolved face, not per-string.
 *   - firefox-config fixtures resolve through firefox.ts's fallback table
 *     (e.g. `Courier New` / `Liberation Mono` -> Source Code Pro).
 *
 * This is the coverage task's cross-family LAYOUT + fallback-table corpus: the
 * fallback machinery in src/config (chrome.ts / firefox.ts) is exercised by
 * fixtures whose CSS stacks resolve through it during layout, not just by
 * per-string measurement.
 *
 * Writes reference.json/reference.png/mask.png (oracle) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes every
 * layer.
 */

import { chromium, firefox } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';
import { chromeConfig, firefoxConfig } from '../dist/config/index.js';
import { setActiveBrowserConfig } from '../dist/config/browser-config.js';

const MASK_PAD = 2;

const corpus = resolve('corpus/cross-family');

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

function rectsToMask(width, height, rects, pad) {
  const mask = new Uint8Array(width * height);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x) - pad);
    const y0 = Math.max(0, Math.floor(r.y) - pad);
    const x1 = Math.min(width, Math.ceil(r.x + r.width) + pad);
    const y1 = Math.min(height, Math.ceil(r.y + r.height) + pad);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const results = [];
const browsers = {};

function getBrowser(target) {
  if (!browsers[target]) {
    browsers[target] = target === 'firefox' ? firefox.launch() : chromium.launch();
  }
  return browsers[target];
}

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:cross-family: corpus directory missing: ${corpus}`);
  process.exit(1);
}

try {
  for (const { dir, name, raw } of fixtures()) {
    const target = raw.browser ?? 'chrome';
    if (target !== 'chrome' && target !== 'firefox') {
      throw new Error(`fixture ${name}: unknown browser target '${target}'`);
    }
    const config = target === 'firefox' ? firefoxConfig : chromeConfig;
    const FONT_FILE = config.defaultFile;
    const FONT_FAMILY = config.defaultFamily;
    setActiveBrowserConfig(config);

    const h = raw.harvest;
    const viewport = h.viewport;
    const page = await (await getBrowser(target)).newPage({ viewport: { width: viewport.width, height: viewport.height } });
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

    // --- engine candidate (the fixture's browser config) ---
    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: FONT_FAMILY,
      fontFile: FONT_FILE,
      browserConfig: config,
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
        const family = m ? m[2].trim() : FONT_FAMILY;
        candidateMeasure[`${font} | ${text}`] = measureTextWidth(text, size, family);
      }
    }

    const mask = rectsToMask(width, height, fragments, MASK_PAD);
    for (const r of h.maskRects ?? []) {
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
      reference: { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects },
      candidate: { measureText: candidateMeasure, computedStyle: out.computedStyles, rect: candidateRects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    console.log(`verified ${name} (${target}): ${width}x${height}, ${fragments.length} text fragments, ${mask.some((b) => b === 1) ? 'masked' : 'no mask'}`);
  }
} finally {
  for (const target of Object.keys(browsers)) {
    await (await browsers[target]).close();
  }
}

const report = buildReport(results, { fixtureSet: 'corpus/cross-family', tolerancesVersion: tolerances.version });
if (results.length === 0) {
  console.error(`verify:cross-family: no fixtures found under ${corpus}`);
  process.exit(1);
}
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
