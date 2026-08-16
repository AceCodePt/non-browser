#!/usr/bin/env node
/**
 * `npm run verify:calc`
 *
 * Renders every corpus/calc fixture with the engine, harvests the Chrome
 * oracle quantities for the same HTML, and diffs layer-by-layer:
 *   - layer-1 measureText  (empty for these fixtures — out of scope, passes)
 *   - layer-2 computedStyle  (empty for these fixtures — out of scope, passes)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension
 *   - layer-4 screenshot  per-pixel delta-E <= 2 with <= 1% exceeding
 *
 * The calc corpus is text-free, so no mask is needed. Writes
 * reference.json/reference.png (Chrome) and candidate.json/candidate.png
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

const corpus = resolve('corpus/calc');

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
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

    const referenceRects = {};
    for (const id of h.rects ?? []) {
      referenceRects[id] = await page.$eval(`#${id}`, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
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
    });
    const candImg = decodePng(out.rgba);

    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify({ measureText: {}, computedStyle: {}, rect: referenceRects }, null, 2) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify({ measureText: {}, computedStyle: {}, rect: out.rects }, null, 2) + '\n',
    );
    writeFileSync(join(dir, 'reference.png'), shot);
    writeFileSync(join(dir, 'candidate.png'), encodePng(candImg.width, candImg.height, candImg.data));

    const fixture = {
      name,
      note: raw.note,
      expected: raw.expected ?? { measureText: 'pass', computedStyle: 'pass', rect: 'pass', screenshot: 'pass' },
      tolerances,
      referenceRgba: refImg.data,
      candidateRgba: candImg.data,
      mask: null,
      reference: { measureText: {}, computedStyle: {}, rect: referenceRects },
      candidate: { measureText: {}, computedStyle: {}, rect: out.rects },
      width,
      height,
    };

    results.push(evaluateFixture(fixture));
    console.log(`verified ${name}: ${width}x${height}`);
  }
} finally {
  await browser.close();
}

const report = buildReport(results, { fixtureSet: 'corpus/calc', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);