#!/usr/bin/env node
/**
 * Shared four-layer verify pipeline (QA-07).
 *
 * Every corpus verify script used to hand-roll the same loop: a fixtures()
 * walker, a textRegionMask(), a near-verbatim Chrome-harvest block, the
 * candidate render + measure, the mask/exclusion handling, the artifact
 * writes, and the buildReport/renderMarkdown/process.exit tail. This module
 * consolidates those so a corpus script reduces to `runVerify` plus its
 * corpus-specific options (corpus dir, fixture-set label). The computedStyle
 * layer is driven by the presence of `harvest.computedStyle` in the fixture,
 * exactly mirroring what the pre-runner scripts did conditionally.
 */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../../dist/harness/png.js';
import { evaluateFixture } from '../../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../../dist/harness/report.js';
import { renderHtml } from '../../dist/layout/render.js';

export const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
export const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

export function* fixtures(corpus) {
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
 * These are the pixels where text rasterization policy (hinting/AA) can
 * differ, so they are compared under the documented text tier
 * (tolerances.json layers.screenshot.text, justified by docs/ledgers/text-mask.md).
 * Pure-white pixels are not text and stay under the §10 band.
 */
export function textRegionMask(width, height, rects, refData, candData) {
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

/** Closes its page, so callers must not reuse the page after this returns. */
export async function harvestChrome(browser, h) {
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

  return { referenceRects, referenceMeasure, referenceComputed, fragments, shot, refImg, width, height };
}

/** candidateComputed is only meaningful when the fixture declares a computedStyle harvest. */
export async function renderCandidate(h) {
  const out = renderHtml(h.html, {
    width: h.viewport.width,
    height: h.viewport.height,
    fontFamily: FONT_FAMILY,
    fontFile: FONT_FILE,
    ...(h.computedStyle ? { computedStyle: h.computedStyle } : {}),
  });
  const candImg = decodePng(out.rgba);

  const candidateRects = out.rects;
  const candidateMeasure = {};
  if (h.measureText) {
    const { measureTextWidth } = await import('../../dist/layout/measure.js');
    for (const { text, font } of h.measureText) {
      const m = font.match(/^([\d.]+)px\s*['"]?([^'"]+)/);
      const size = m ? parseFloat(m[1]) : 14;
      const family = m ? m[2].trim() : FONT_FAMILY;
      candidateMeasure[`${font} | ${text}`] = measureTextWidth(text, size, family);
    }
  }

  return { candImg, candidateRects, candidateMeasure, candidateComputed: out.computedStyles };
}

/**
 * Exclusion mask = declared maskRects/maskElements only. Text pixels are NOT
 * excluded: they are compared under the documented text tier (tolerances.json
 * layers.screenshot.text, justified by docs/ledgers/text-mask.md). The
 * exclusion mask covers only what the engine cannot reproduce (e.g. the
 * Chrome broken-image icon on <img>) — every masked pixel is justified per
 * fixture.
 */
export function exclusionMask(width, height, h, referenceRects, name) {
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
  // Replaced elements whose Chrome placeholder can't be reproduced by the
  // engine (e.g. the broken-image icon on <img>) are masked by border box.
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
  return mask;
}

export function writeArtifacts(dir, { width, height, referenceMeasure, referenceComputed, referenceRects, shot, candImg, candidateMeasure, candidateComputed, candidateRects, mask, textMask }) {
  writeFileSync(
    join(dir, 'reference.json'),
    JSON.stringify({ measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects }, null, 2) + '\n',
  );
  writeFileSync(
    join(dir, 'candidate.json'),
    JSON.stringify({ measureText: candidateMeasure, computedStyle: candidateComputed, rect: candidateRects }, null, 2) + '\n',
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
}

export function reportTail(results, tolerances, fixtureSet) {
  const report = buildReport(results, { fixtureSet, tolerancesVersion: tolerances.version });
  const outDir = writeReport(report);
  console.log(renderMarkdown(report));
  const ok = report.allChecksPass;
  console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
  process.exit(ok ? 0 : 1);
}

export async function runVerify({ corpus, fixtureSet }) {
  const tolerances = loadTolerances(resolve('tolerances.json'));
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const { dir, name, raw } of fixtures(corpus)) {
      const h = raw.harvest;
      const { referenceRects, referenceMeasure, referenceComputed, fragments, shot, refImg, width, height } =
        await harvestChrome(browser, h);
      const { candImg, candidateRects, candidateMeasure, candidateComputed } = await renderCandidate(h);

      const textMask = textRegionMask(width, height, fragments, refImg.data, candImg.data);
      const mask = exclusionMask(width, height, h, referenceRects, name);

      writeArtifacts(dir, {
        width,
        height,
        referenceMeasure,
        referenceComputed,
        referenceRects,
        shot,
        candImg,
        candidateMeasure,
        candidateComputed,
        candidateRects,
        mask,
        textMask,
      });

      const textPixels = textMask.reduce((a, b) => a + b, 0);

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

      results.push(evaluateFixture(fixture));
      console.log(
        `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
          `${textPixels} text px compared, ${mask.reduce((a, b) => a + b, 0)} masked`,
      );
    }
  } finally {
    await browser.close();
  }

  reportTail(results, tolerances, fixtureSet);
}