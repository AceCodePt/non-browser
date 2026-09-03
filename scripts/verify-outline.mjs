#!/usr/bin/env node
/**
 * `npm run verify:outline`
 *
 * Renders every corpus/outline fixture with the engine, harvests the Chrome
 * oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-2 computedStyle  exact string equality (outline-width/style/color/
 *     offset serialize as Chrome's CSSOM; the shorthand reports color, style,
 *     width and never outline-offset)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension, PLUS an
 *     outline-blindness gate: the engine re-renders each fixture with the
 *     outline declarations stripped and the rect map must be exactly identical
 *     — outline is paint-only and must not move a single rect
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding for
 *     non-text pixels; the corpus carries no text, so the whole buffer is
 *     compared under the §10 band
 *
 * Writes reference.json/reference.png (Chrome) and candidate.json/candidate.png
 * (engine) into each fixture directory, then a report under docs/reports/.
 * Exits 0 only when every fixture passes.
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

const corpus = resolve('corpus/outline');

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

// Strip every outline longhand/shorthand declaration from the fixture HTML so
// the engine re-renders the identical page without outline. Fixtures author
// outline only in style attributes (values never contain ';'), so a
// declaration-scoped removal is exact.
function stripOutline(html) {
  return html.replace(/outline(-[a-z-]+)?\s*:\s*[^;}'"]*;?/g, '');
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];
let layoutGateFailed = false;

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:outline: corpus directory missing: ${corpus}`);
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
    });
    const candImg = decodePng(out.rgba);

    // Layout-blindness gate: rects must be identical with and without outline.
    const stripped = renderHtml(stripOutline(h.html), {
      width: viewport.width,
      height: viewport.height,
      fontFamily: FONT_FAMILY,
      fontFile: FONT_FILE,
    });
    const rectsEqual = JSON.stringify(stripped.rects) === JSON.stringify(out.rects);
    if (!rectsEqual) {
      layoutGateFailed = true;
      console.error(`verify:outline: layout gate FAILED for ${name} — outline changed rects`);
      for (const id of Object.keys(out.rects)) {
        if (JSON.stringify(stripped.rects[id]) !== JSON.stringify(out.rects[id])) {
          console.error(`  ${id}: with=${JSON.stringify(out.rects[id])} without=${JSON.stringify(stripped.rects[id])}`);
        }
      }
    }

    const candidateRects = out.rects;

    // The outline corpus carries no text; the whole buffer is non-text and is
    // compared strictly under the §10 band (mask empty).
    const mask = new Uint8Array(width * height);
    const textMask = new Uint8Array(width * height);

    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify({ measureText: {}, computedStyle: referenceComputed, rect: referenceRects }, null, 2) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify({ measureText: {}, computedStyle: out.computedStyles, rect: candidateRects }, null, 2) + '\n',
    );
    writeFileSync(join(dir, 'reference.png'), shot);
    writeFileSync(join(dir, 'candidate.png'), encodePng(candImg.width, candImg.height, candImg.data));

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
      reference: { measureText: {}, computedStyle: referenceComputed, rect: referenceRects },
      candidate: { measureText: {}, computedStyle: out.computedStyles, rect: candidateRects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    console.log(
      `verified ${name}: ${width}x${height}, layout gate ${rectsEqual ? 'ok' : 'FAILED'}`,
    );
  }
} finally {
  await browser.close();
}

if (results.length === 0) {
  console.error(`verify:outline: no fixtures found under ${corpus}`);
  process.exit(1);
}
if (layoutGateFailed) {
  console.error('verify:outline: FAIL — outline must not affect layout rects');
  process.exit(1);
}

const report = buildReport(results, { fixtureSet: 'corpus/outline', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
