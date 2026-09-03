#!/usr/bin/env node
/**
 * `node scripts/verify-unicode-bidi.mjs`
 *
 * The acceptance gate for the unicode-bidi property and the bdo element
 * (task tasks/unicode-bidi). Renders every corpus/unicode-bidi fixture with
 * the engine and diffs against headless Chrome:
 *   - computedStyle  exact string equality for the declared props — the
 *     unicode-bidi/direction/text-align computed values that drive the bidi
 *     surface (bdo's UA isolate-override, the block-level isolate default, the
 *     author bidi-override/isolate/isolate-override/plaintext values)
 *   - rect           getBoundingClientRect  max Δ ≤ 0.5px per box dimension
 *     (bdo/override/isolate inline boxes keep their logical position; the
 *     block-level override boxes land per their direction)
 *   - text fragments Range.getClientRects() vs the engine's textFragments on
 *     the declared textElements — the line boxes of single-direction override
 *     blocks must sit at the inline-start edge Chrome puts them at, which is
 *     what requirement 3 (bidi-override forcing inline alignment) observes
 *   - screenshot     per-pixel ΔE ≤ 2 with ≤ 1% non-text pixels exceeding;
 *     the override runs' mirrored glyphs (the declared no-UBA divergence) fall
 *     under the documented text tier via the text-mask
 *
 * Writes reference.json/reference.png (Chrome) and candidate.json/candidate.png
 * (engine) plus text-mask.png into each fixture directory, then a report under
 * docs/reports/. Exits 0 only when every fixture passes every layer and the
 * fragment gate.
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

const corpus = resolve('corpus/unicode-bidi');
const tolerances = loadTolerances(resolve('tolerances.json'));
const maxPx = tolerances.layers.rect.maxPx;

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

if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify-unicode-bidi: corpus directory missing: ${corpus}`);
  process.exit(1);
}

const browser = await chromium.launch();
const results = [];
const failures = [];
let fixtureCount = 0;
let worstFrag = 0;

try {
  for (const { dir, name, raw } of fixtures()) {
    fixtureCount++;
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

    const fragments = [];
    const referenceFragments = {};
    if (h.textElements && h.textElements.length > 0) {
      for (const id of h.textElements) {
        const frags = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return [];
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
        }, id);
        referenceFragments[id] = frags;
        fragments.push(...frags);
      }
    }
    // Content boxes of elements whose visible region Range.getClientRects does
    // not report (or whose fragments are not compared) join the text-region
    // tier with the other fragments — the paragraph glyphs of a line whose
    // mixed-direction reordering is a declared divergence still belong in the
    // text tier, not the strict band.
    if (h.maskContentBoxes && h.maskContentBoxes.length > 0) {
      for (const id of h.maskContentBoxes) {
        const box = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const inset = (v) => parseFloat(v) || 0;
          const x = r.x + inset(cs.borderLeftWidth) + inset(cs.paddingLeft);
          const y = r.y + inset(cs.borderTopWidth) + inset(cs.paddingTop);
          return {
            x,
            y,
            width: r.width - inset(cs.borderLeftWidth) - inset(cs.borderRightWidth) - inset(cs.paddingLeft) - inset(cs.paddingRight),
            height: r.height - inset(cs.borderTopWidth) - inset(cs.borderBottomWidth) - inset(cs.paddingTop) - inset(cs.paddingBottom),
          };
        }, id);
        if (box) fragments.push(box);
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
      textElements: h.textElements,
    });
    const candImg = decodePng(out.rgba);
    const candidateRects = out.rects;

    const textMask = textRegionMask(width, height, fragments, refImg.data, candImg.data);
    const mask = new Uint8Array(width * height);

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
    if (textMask.some((b) => b === 1)) {
      const rgba = Buffer.alloc(width * height * 4);
      for (let i = 0; i < width * height; i++) if (textMask[i] === 1) rgba[i * 4 + 3] = 255;
      writeFileSync(join(dir, 'text-mask.png'), encodePng(width, height, rgba));
    }

    // --- text-fragment gate (line boxes at the inline-start edge per the
    // override's direction) ---
    if (h.textElements) {
      for (const id of h.textElements) {
        const c = referenceFragments[id] ?? [];
        const e = out.textFragments[id] ?? [];
        if (c.length !== e.length) {
          failures.push(`fixture '${name}': '${id}' fragment count — chrome ${c.length} vs engine ${e.length}`);
          continue;
        }
        for (let k = 0; k < c.length; k++) {
          for (const d of ['x', 'y', 'width', 'height']) {
            const m = Math.abs(c[k][d] - e[k][d]);
            worstFrag = Math.max(worstFrag, m);
            if (m > maxPx) {
              failures.push(`fixture '${name}': '${id}' fragment ${d} Δ ${m.toFixed(3)}px > ${maxPx}px`);
            }
          }
        }
      }
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
      reference: { measureText: {}, computedStyle: referenceComputed, rect: referenceRects },
      candidate: { measureText: {}, computedStyle: out.computedStyles, rect: candidateRects },
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

if (fixtureCount === 0) {
  console.error(`verify-unicode-bidi: no fixtures found under ${corpus}`);
  process.exit(1);
}

const report = buildReport(results, { fixtureSet: 'corpus/unicode-bidi', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
const ok = report.allChecksPass && failures.length === 0;
for (const f of failures) console.error(`verify-unicode-bidi: FAIL - ${f}`);
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);