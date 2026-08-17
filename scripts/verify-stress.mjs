#!/usr/bin/env node
/**
 * `node scripts/verify-stress.mjs`
 *
 * Renders every corpus/stress fixture with the engine and diffs all four layers
 * against headless Chrome (Playwright) at every declared viewport, per the
 * charter §2 four-layer model. The stress corpus is the page-scale / variety
 * gate: several small fixtures each packing many CSS properties plus one big
 * kitchen-sink page, each rendered at small (mobile) resolutions in addition to
 * a desktop viewport.
 *
 * Each fixture's `harvest.viewports` array drives one full four-layer pass per
 * entry, so a fixture can assert low-resolution parity (e.g. 320x568, 360x640)
 * and desktop parity in the same fixture. Layer-by-layer:
 *   - layer-1 measureText    candidate engine vs Chrome canvas, sub-pixel
 *   - layer-2 computedStyle  exact string equality
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot     per-pixel delta-E <= 2 with <= 1% pixels exceeding
 *
 * Text glyph pixels are placed under the documented text tier
 * (tolerances.json layers.screenshot.text, docs/ledgers/text-mask.md): the mask
 * is every pixel inside Chrome's text fragments (plus the engine's generated
 * pseudo/text rects) that either rasterizer paints as non-white.
 *
 * Writes viewport-suffixed reference/candidate JSON+PNG into each fixture
 * directory (e.g. reference-360x640.json), then a report under
 * docs/reports/stress/. Exits 0 only when every fixture x viewport passes.
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const corpus = resolve('corpus/stress');
if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify-stress: corpus directory missing: ${corpus}`);
  process.exit(1);
}

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

function padded(r, p, width, height) {
  return {
    x: Math.max(0, r.x - p),
    y: Math.max(0, r.y - p),
    width: Math.min(width, r.x + r.width + p) - Math.max(0, r.x - p),
    height: Math.min(height, r.y + r.height + p) - Math.max(0, r.y - p),
  };
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];

try {
  for (const { dir, name, raw } of fixtures()) {
    const h = raw.harvest;
    const specs = h.computedStyle ?? [];
    const viewports = h.viewports ?? (h.viewport ? [h.viewport] : []);
    if (viewports.length === 0) throw new Error(`fixture ${name}: no viewport declared`);
    const expected = raw.expected ?? {
      measureText: 'pass',
      computedStyle: 'pass',
      rect: 'pass',
      screenshot: 'pass',
    };

    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
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
      if (specs.length > 0) {
        for (const { id, pseudo, props } of specs) {
          const key = pseudo ? `${id}::${pseudo}` : id;
          referenceComputed[key] = await page.evaluate(
            ({ id, pseudo, props }) => {
              const cs = getComputedStyle(document.getElementById(id), pseudo ?? undefined);
              const out = {};
              for (const p of props) out[p] = cs.getPropertyValue(p);
              return out;
            },
            { id, pseudo, props },
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

      const out = renderHtml(h.html, {
        width: vp.width,
        height: vp.height,
        fontFamily: FONT_FAMILY,
        fontFile: FONT_FILE,
        computedStyle: specs,
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

      const generated = (out.generatedTextRects ?? []).map((r) => padded(r, 2, width, height));
      const textMask = textRegionMask(width, height, [...fragments, ...generated], refImg.data, candImg.data);
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

      const vpSuffix = `${vp.width}x${vp.height}`;
      writeFileSync(
        join(dir, `reference-${vpSuffix}.json`),
        JSON.stringify(
          { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects },
          null,
          2,
        ) + '\n',
      );
      writeFileSync(
        join(dir, `candidate-${vpSuffix}.json`),
        JSON.stringify(
          { measureText: candidateMeasure, computedStyle: out.computedStyles, rect: candidateRects },
          null,
          2,
        ) + '\n',
      );
      writeFileSync(join(dir, `reference-${vpSuffix}.png`), shot);
      writeFileSync(join(dir, `candidate-${vpSuffix}.png`), encodePng(candImg.width, candImg.height, candImg.data));
      const writeMaskPng = (file, m) => {
        const rgba = Buffer.alloc(width * height * 4);
        for (let i = 0; i < width * height; i++) if (m[i] === 1) rgba[i * 4 + 3] = 255;
        writeFileSync(join(dir, file), encodePng(width, height, rgba));
      };
      if (mask.some((b) => b === 1)) writeMaskPng(`mask-${vpSuffix}.png`, mask);
      if (textMask.some((b) => b === 1)) writeMaskPng(`text-mask-${vpSuffix}.png`, textMask);

      const textPixels = textMask.reduce((a, b) => a + b, 0);
      const fixture = {
        name: `${name}@${vpSuffix}`,
        note: `${raw.note} [viewport ${vpSuffix}]`,
        expected,
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
        `verified ${name}@${vpSuffix}: ${width}x${height}, ${fragments.length} text fragments, ` +
          `${textPixels} text px compared, ${mask.reduce((a, b) => a + b, 0)} masked`,
      );
    }
  }
} finally {
  await browser.close();
}

if (results.length === 0) {
  console.error('verify-stress: no fixtures found under corpus/stress');
  process.exit(1);
}
const report = buildReport(results, { fixtureSet: 'corpus/stress', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
