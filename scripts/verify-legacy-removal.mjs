#!/usr/bin/env node
/**
 * `npm run verify:legacy-removal`
 *
 * Proves the modern-compat legacy-removal contract: deprecated HTML elements
 * (center, tt, dir, menu, font, big, strike) get NO UA styling and render as
 * generic block boxes. The corpus fixture declares a typed fail on every layer
 * that diverges — Chrome still styles these elements — and this script does two
 * things:
 *
 *   1. removal contract — asserts the ENGINE's computed styles for each legacy
 *      element are the generic-box values (block display, no centering, no
 *      monospace, zero list padding). This is the proof the removal landed; it
 *      is engine-side and independent of the Chrome diff.
 *   2. typed-gap gate — renders the same fixture in headless Chrome and asserts
 *      the engine still diverges on the declared gap layers (the fixture can
 *      only move toward zero by re-styling legacy elements, never by silently
 *      editing the fixture).
 *
 * Writes reference.json/reference.png (Chrome) and candidate.json/candidate.png
 * (engine) into the fixture directory, then a report under docs/reports/.
 * Exits 0 only when the removal contract holds AND every declared gap still
 * diverges.
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

const corpus = resolve('corpus/legacy-removal');

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
 * The engine-side removal contract. Each legacy element must resolve to a
 * generic box: block display, no UA-only styling (centering, monospace, list
 * padding). Keyed by fixture id → the computed-style values that prove removal.
 */
const REMOVAL_CONTRACT = {
  c: { 'text-align': 'start' },
  tt: { display: 'block', 'font-family': `"${chromeConfig.defaultFamily}"` },
  dir: { display: 'block', 'padding-left': '0px' },
  menu: { display: 'block', 'padding-left': '0px' },
  font: { display: 'block' },
  big: { display: 'block' },
  strike: { display: 'block', 'text-decoration-line': 'none' },
};

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];
let contractOk = true;

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:legacy-removal: corpus directory missing: ${corpus}`);
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
      fontFamily: chromeConfig.defaultFamily,
      fontFile: chromeConfig.defaultFile,
      browserConfig: chromeConfig,
      computedStyle: h.computedStyle,
    });
    const candImg = decodePng(out.rgba);

    // --- removal contract: the engine must render legacy elements as generic
    // boxes regardless of what Chrome does. Any deviation fails the task even
    // though the typed gaps still diverge. ---
    for (const [id, expected] of Object.entries(REMOVAL_CONTRACT)) {
      const actual = out.computedStyles[id];
      if (!actual) {
        console.error(`verify:legacy-removal: missing engine computed style for id '${id}'`);
        contractOk = false;
        continue;
      }
      for (const [prop, want] of Object.entries(expected)) {
        if (actual[prop] !== want) {
          console.error(
            `verify:legacy-removal: removal contract violated for #${id} ${prop}: got '${actual[prop]}', want '${want}'`,
          );
          contractOk = false;
        }
      }
    }

    const candidateRects = out.rects;
    const mask = new Uint8Array(width * height);
    const textMask = new Uint8Array(width * height);

    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify(
        { measureText: {}, computedStyle: referenceComputed, rect: referenceRects },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify(
        { measureText: {}, computedStyle: out.computedStyles, rect: candidateRects },
        null,
        2,
      ) + '\n',
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
    console.log(`verified ${name}: ${width}x${height}`);
  }
} finally {
  await browser.close();
}

if (!contractOk) {
  console.error('verify:legacy-removal: FAIL — legacy elements are still special-cased');
  process.exit(1);
}

const report = buildReport(results, { fixtureSet: 'corpus/legacy-removal', tolerancesVersion: tolerances.version });
if (results.length === 0) {
  console.error(`verify:legacy-removal: no fixtures found under ${corpus}`);
  process.exit(1);
}
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);