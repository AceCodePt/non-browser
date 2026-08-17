#!/usr/bin/env node
/**
 * `node scripts/verify-rtl.mjs`
 *
 * The daemon's acceptance gate for direction:rtl layout (session-idle *rtl*
 * case, with the hook's no-op guard). Renders every corpus/rtl-layout fixture
 * with the engine, harvests the Chrome oracle for the same HTML, and diffs:
 *   - layer-3 getBoundingClientRect  max Δ ≤ 0.5px per box dimension, plus the
 *     alignment-critical geometry: each text element's line fragments (Chrome
 *     Range.getClientRects() vs the engine's textFragments) compared on all
 *     four dims within the same tolerance — RTL line boxes must sit at the
 *     inline-start (right) edge where Chrome puts them
 *   - computedStyle  exact string equality for the declared props (direction,
 *     text-align — the computed values that drive the mapping)
 *
 * Unlike the four-layer verifies this gate is rect-only: RTL *text*
 * measurement is measure-corpus scope (the task forbids touching it), so
 * glyph/ink parity is not compared here. A fixture may declare per-fixture
 * fonts (e.g. Droid Sans Hebrew for an RTL paragraph) plus its default
 * family; both the engine and Chrome resolve them through fontconfig.
 *
 * Exits non-zero when the corpus directory is absent, empty, or any fixture
 * diverges beyond the layer-3 tolerance.
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { renderHtml } from '../dist/layout/render.js';
import { chromeConfig } from '../dist/config/chrome.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const corpus = resolve('corpus/rtl-layout');
const tolerances = loadTolerances(resolve('tolerances.json'));
const maxPx = tolerances.layers.rect.maxPx;

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify-rtl: corpus directory missing: ${corpus}`);
  process.exit(1);
}

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

const cfg = chromeConfig;
const browser = await chromium.launch();
const failures = [];
let fixtureCount = 0;
let worstBox = 0;
let worstFrag = 0;

try {
  for (const { name, raw } of fixtures()) {
    fixtureCount++;
    const h = raw.harvest;
    const viewport = h.viewport;
    const fixtureFonts = (h.fonts ?? []).map((f) => ({ family: f.family, filePath: f.file }));
    const defaultFamily = h.defaultFamily ?? FONT_FAMILY;
    const defaultFile =
      fixtureFonts.find((f) => f.family === defaultFamily)?.filePath ??
      cfg.fonts.find((f) => f.family === defaultFamily)?.filePath ??
      FONT_FILE;
    const browserConfig = {
      browser: 'chrome',
      fonts: [...cfg.fonts, ...fixtureFonts],
      fallback: cfg.fallback,
      defaultFamily,
      defaultFile,
    };

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

    const referenceFragments = {};
    if (h.textElements && h.textElements.length > 0) {
      for (const id of h.textElements) {
        referenceFragments[id] = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return [];
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
        }, id);
      }
    }
    await page.close();

    const out = renderHtml(h.html, {
      width: viewport.width,
      height: viewport.height,
      fontFamily: defaultFamily,
      fontFile: defaultFile,
      browserConfig,
      computedStyle: h.computedStyle,
      textElements: h.textElements,
    });

    // --- layer-3 box rects ---
    let maxDelta = 0;
    let boxes = 0;
    for (const [id, r] of Object.entries(referenceRects)) {
      const e = out.rects[id];
      if (!e) {
        failures.push(`fixture '${name}': engine produced no rect for '${id}'`);
        continue;
      }
      boxes++;
      for (const d of ['x', 'y', 'width', 'height']) maxDelta = Math.max(maxDelta, Math.abs(r[d] - e[d]));
    }
    worstBox = Math.max(worstBox, maxDelta);
    if (boxes > 0 && maxDelta > maxPx) {
      failures.push(`fixture '${name}': rect max Δ ${maxDelta.toFixed(3)}px > ${maxPx}px over ${boxes} box(es)`);
    }

    // --- computed style strings ---
    if (h.computedStyle) {
      for (const { id, props } of h.computedStyle) {
        const ref = referenceComputed[id];
        const cand = out.computedStyles[id];
        if (!ref || !cand) {
          failures.push(`fixture '${name}': computedStyle missing for '${id}'`);
          continue;
        }
        for (const p of props) {
          if (ref[p] !== cand[p]) {
            failures.push(`fixture '${name}': computed ${p} for '${id}' — chrome '${ref[p]}' vs engine '${cand[p]}'`);
          }
        }
      }
    }

    // --- line-fragment geometry (RTL line boxes at the inline-start edge) ---
    let fragMax = 0;
    if (h.textElements) {
      for (const id of h.textElements) {
        const c = referenceFragments[id] ?? [];
        const e = out.textFragments[id] ?? [];
        if (c.length !== e.length) {
          failures.push(`fixture '${name}': '${id}' fragment count — chrome ${c.length} vs engine ${e.length}`);
          continue;
        }
        let m = 0;
        let dims = 0;
        for (let k = 0; k < c.length; k++) {
          for (const d of ['x', 'y', 'width', 'height']) {
            dims++;
            m = Math.max(m, Math.abs(c[k][d] - e[k][d]));
          }
        }
        fragMax = Math.max(fragMax, m);
        worstFrag = Math.max(worstFrag, m);
        if (m > maxPx) {
          failures.push(`fixture '${name}': '${id}' fragment max Δ ${m.toFixed(3)}px > ${maxPx}px over ${dims} dim(s)`);
        }
      }
    }

    console.log(
      `verified ${name}: ${viewport.width}x${viewport.height}, ${boxes} box(es) max Δ ${maxDelta.toFixed(3)}px` +
        `${h.textElements?.length ? `, fragments max Δ ${fragMax.toFixed(3)}px` : ''}`,
    );
  }
} finally {
  await browser.close();
}

if (fixtureCount === 0) {
  console.error(`verify-rtl: no fixtures under ${corpus}`);
  process.exit(1);
}

const ok = failures.length === 0;
for (const f of failures) console.error(`verify-rtl: FAIL - ${f}`);
if (ok) {
  console.log(`verify-rtl: PASS — ${fixtureCount} fixture(s), worst rect max Δ ${worstBox.toFixed(3)}px, worst fragment max Δ ${worstFrag.toFixed(3)}px (≤ ${maxPx}px)`);
} else {
  console.error(`verify-rtl: FAIL — ${failures.length} divergence(s) across ${fixtureCount} fixture(s)`);
}
process.exit(ok ? 0 : 1);