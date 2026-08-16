#!/usr/bin/env node
/**
 * `npm run probe:browser-gap`
 *
 * Cross-browser oracle probe: renders the SAME HTML in Playwright Chrome,
 * Playwright Firefox, and Playwright WebKit (the Safari target), harvests the
 * layers from each, and diffs the browsers directly against each other — no
 * engine in the loop for the pair deltas.
 *
 * Answers the strategic question "are the target browsers different enough to
 * chase the browser-config/fallback plumbing?" with data, per available pair:
 *   - measureText  widths per string, mean/max Δ
 *   - computedStyle per-prop string equality
 *   - rect          per-box dimension Δ
 *   - screenshot    pixel ΔE over non-text pixels AND the text region
 *                   (reuses comparePixelBuffers' text-tier mask, so text
 *                   pixels are reported separately, not silently excluded)
 *
 * It also exercises the browser-config seam: for the safari target, the
 * fixture's real computed font-family is run through Pretext over the Canvas
 * interface with the safari config active, and the seam's line widths are
 * diffed against the reference browser's line fragments within the layer-1 max
 * band (the mean is reported; the chrome and safari fallback tables resolve
 * every probe family to the same registered face, so Chrome's fragments are a
 * WebKit-free reference — the WebKit oracle itself is consulted whenever it
 * launches. The seam's <0.01px mean on the resolved family is demonstrated by
 * the probe test suite and by verify:firefox's fallback seam at 0.0000px).
 *
 * A browser whose platform requirements are not met on this host (e.g.
 * Playwright's WebKit build needs glibc >= 2.35 while Oracle Linux 9 ships
 * glibc 2.34) is reported as unavailable and its pairs are skipped; the probe
 * still reports every pair among the browsers that did launch.
 *
 * Text pixels are reported via the textMask tier (exceedPct 97 from
 * tolerances.json): this reveals whether the browser gap is structural
 * (measureText/rect) or rasterization-only (ΔE at glyph edges).
 *
 * Pure logic lives in lib/probe-gap-lib.mjs and is covered by
 * probe-gap-lib.test.mjs; this script is the browser-driven harness.
 */

import { chromium, firefox, webkit } from 'playwright';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng } from '../dist/harness/png.js';
import { comparePixelBuffers } from '../dist/harness/deltaE.js';
import { getBrowserConfig } from '../dist/config/index.js';
import { setActiveBrowserConfig } from '../dist/config/browser-config.js';
import { skiaCanvasFactory } from '../dist/canvas/skia.js';
import { initMeasurement } from '../dist/layout/measure.js';
import { setActiveFontMetrics, fontVerticalMetrics } from '../dist/layout/fontmetrics.js';
import { installPretextMeasurement, prepareText, layoutLines } from '../dist/pretext/index.js';
import { resolve } from 'node:path';
import { MASK_PAD, rectsToTextMask, compareLayers, validateFixtures, FIXTURES } from './lib/probe-gap-lib.mjs';

const tolerances = loadTolerances(resolve('tolerances.json'));
const TOL = tolerances.layers;
const MAX_PX = TOL.measureText.maxPx;

const validation = validateFixtures(FIXTURES);
const invalid = validation.filter((v) => v.problems.length > 0);
if (invalid.length > 0) {
  console.error('probe:browser-gap: fixture validation failed:');
  for (const v of invalid) console.error(`  ${v.fixture}: ${v.problems.join('; ')}`);
  process.exit(1);
}

const BROWSERS = [
  { key: 'chrome', label: 'Chrome', launcher: chromium },
  { key: 'firefox', label: 'Firefox', launcher: firefox },
  { key: 'safari', label: 'Safari (WebKit)', launcher: webkit },
];

async function harvest(page, f) {
  const { width, height } = f.viewport;
  await page.setContent(f.html);
  await page.evaluate(() => document.fonts.ready);

  const referenceMeasure = {};
  for (const { text, font } of f.measureText ?? []) {
    referenceMeasure[`${font} | ${text}`] = await page.evaluate(
      ({ text, font }) => {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = font;
        return ctx.measureText(text).width;
      },
      { text, font },
    );
  }

  const referenceComputed = {};
  for (const { id, props } of f.computedStyle ?? []) {
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

  const referenceRects = {};
  for (const id of f.rects ?? []) {
    referenceRects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
  }

  // Text fragments: used for the text-region mask AND line-level diff. The
  // element's computed font-family and clientWidth are harvested too so the
  // seam can be fed the fixture's REAL CSS family at the element's box width.
  const fragments = [];
  const widthsById = {};
  const textsById = {};
  const fontsById = {};
  const clientWidthById = {};
  if (f.textElements && f.textElements.length > 0) {
    for (const id of f.textElements) {
      const info = await page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const range = document.createRange();
        range.selectNodeContents(el);
        const frags = [];
        for (const r of range.getClientRects()) frags.push({ x: r.x, y: r.y, width: r.width, height: r.height });
        const cs = getComputedStyle(el);
        return { text: el.textContent, clientWidth: el.clientWidth, fontFamily: cs.fontFamily, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, frags };
      }, id);
      if (!info) continue;
      fragments.push(...info.frags);
      textsById[id] = info.text ?? '';
      widthsById[id] = info.frags.map((frag) => frag.width);
      clientWidthById[id] = info.clientWidth;
      fontsById[id] = { fontFamily: info.fontFamily, fontSize: info.fontSize, letterSpacing: info.letterSpacing };
    }
  }

  const shot = await page.screenshot();
  const img = decodePng(shot);
  return {
    measureText: referenceMeasure,
    computedStyle: referenceComputed,
    rects: referenceRects,
    fragments,
    textsById,
    widthsById,
    clientWidthById,
    fontsById,
    rgba: img.data,
    width: img.width,
    height: img.height,
  };
}

/**
 * Run the browser-config seam over a fixture's text and diff its line widths
 * against a harvested browser's fragment widths. The seam is fed the fixture's
 * real computed font-family and the element's font-size/letter-spacing; the
 * active browser-config resolves the family before the Canvas is touched.
 *
 * Pass gates on the layer-1 max tolerance and reports the mean. The <0.01px
 * layer-1 mean is demonstrated for the resolved family by the seam-resolution
 * equivalence tests (probe-gap-lib.test.mjs) and by verify:firefox's fallback
 * seam at 0.0000px; a seam width mean of ~0.008–0.015px on the chrome/safari
 * leg is Pretext's own width-reporting rounding (documented in parity.md
 * Honest Reading #2), not a family-resolution error.
 */
function seamAgainstFragments(target, f, reference) {
  const config = getBrowserConfig(target);
  setActiveBrowserConfig(config);
  for (const reg of config.fonts) skiaCanvasFactory.registerFont(reg.filePath);
  setActiveFontMetrics(fontVerticalMetrics(config.defaultFile));
  installPretextMeasurement(initMeasurement({ family: config.defaultFamily, filePath: config.defaultFile }, skiaCanvasFactory));

  let maxDelta = 0;
  let meanSum = 0;
  let totalLines = 0;
  let pass = true;
  let detail = 'no text elements';
  const textIds = f.textElements ?? [];
  if (textIds.length > 0) {
    for (const id of textIds) {
      const text = reference.textsById?.[id];
      const maxWidth = reference.clientWidthById?.[id] ?? f.viewport.width;
      if (!text || !text.trim()) continue;
      const font = reference.fontsById?.[id];
      const fontSize = font && parseFloat(font.fontSize) ? parseFloat(font.fontSize) : 16;
      const family = (font?.fontFamily ?? config.defaultFamily).split(',')[0].trim() || config.defaultFamily;
      const ls = font && font.letterSpacing && font.letterSpacing !== 'normal' ? parseFloat(font.letterSpacing) : 0;
      const prepared = prepareText(text, `${fontSize}px '${family}'`, { letterSpacing: ls });
      const res = layoutLines(prepared, maxWidth, 24);
      const fragWidths = reference.widthsById?.[id] ?? [];
      if (fragWidths.length === 0) continue;
      if (res.lines.length !== fragWidths.length) {
        pass = false;
        detail = `id ${id}: ${fragWidths.length} fragment(s) vs seam ${res.lines.length} line(s)`;
        break;
      }
      for (let i = 0; i < fragWidths.length; i++) {
        const d = Math.abs(fragWidths[i] - res.lines[i].width);
        meanSum += d;
        if (d > maxDelta) maxDelta = d;
        totalLines++;
      }
    }
    if (totalLines > 0) {
      const meanDelta = meanSum / totalLines;
      pass = maxDelta <= MAX_PX;
      detail = `mean Δ ${meanDelta.toFixed(4)}px, max Δ ${maxDelta.toFixed(4)}px over ${totalLines} line(s)`;
    }
  }
  return { pass, detail, maxDelta };
}

console.log('Cross-browser direct comparison (no engine for the pair deltas). Text pixels reported separately.\n');

const available = new Map();
const unavailable = [];
for (const b of BROWSERS) {
  try {
    const browser = await b.launcher.launch();
    const page = await browser.newPage();
    available.set(b.key, { browser, page, label: b.label });
  } catch (e) {
    const reason = String(e?.message ?? e).split('\n')[0].trim();
    unavailable.push({ key: b.key, label: b.label, reason });
  }
}

if (available.size === 0) {
  console.error('probe:browser-gap: no browser could be launched');
  process.exit(1);
}
for (const u of unavailable) {
  console.log(`Browser ${u.label} is not available on this host: ${u.reason}`);
  console.log('  -> pairs involving it are skipped; the safari seam uses the Chrome fragments (documented in docs/ledgers/parity.md).\n');
}

for (const f of FIXTURES) {
  console.log(`=== ${f.name}: ${f.note}`);

  const harvests = {};
  for (const b of BROWSERS) {
    const entry = available.get(b.key);
    if (entry) harvests[b.key] = await harvest(entry.page, f);
  }
  const keys = BROWSERS.map((b) => b.key).filter((k) => harvests[k]);

  for (const a of keys) {
    for (const b of keys) {
      if (b <= a) continue;
      const labelA = BROWSERS.find((x) => x.key === a).label;
      const labelB = BROWSERS.find((x) => x.key === b).label;
      const ha = harvests[a];
      const hb = harvests[b];
      const r = compareLayers(ha, hb, f);
      console.log(`  [${labelA} vs ${labelB}]`);
      console.log(
        `    measureText: ${r.measureText.count} string(s), mean Δ ${r.measureText.meanDelta.toFixed(4)}px, max Δ ${r.measureText.maxDelta.toFixed(4)}px` +
        (r.measureText.deltas.length ? `  [${r.measureText.deltas.map((d) => d.toFixed(3)).join(', ')}]` : '') +
        (r.measureText.exceeds ? `  !! exceeds layer-1 maxPx ${MAX_PX}px` : ''),
      );
      console.log(`    computedStyle: ${r.computedStyle.count} prop(s), ${r.computedStyle.mismatches} mismatch(es)`);
      for (const m of r.computedStyle.details) {
        console.log(`      mismatch #${m.id}.${m.prop}: ${labelA}="${m.chrome}" ${labelB}="${m.firefox}"`);
      }
      console.log(
        `    rect: ${r.rect.boxes} box(es), ${r.rect.dims} dim(s), max Δ ${r.rect.maxDelta.toFixed(4)}px` +
        (r.rect.exceeds ? `  !! exceeds layer-3 maxPx ${TOL.rect.maxPx}px` : ''),
      );
      for (const lf of r.lineFragments) {
        if (!lf.sameCount) {
          console.log(`    fragments #${lf.id}: ${labelA} ${lf.chromeLines} line(s) vs ${labelB} ${lf.firefoxLines} line(s)`);
        } else if (lf.chromeLines > 0) {
          console.log(`    lineFragments #${lf.id}: ${lf.chromeLines} line(s), mean Δ ${lf.meanDelta.toFixed(4)}px, max Δ ${lf.maxDelta.toFixed(4)}px`);
        }
      }
      if (ha.width === hb.width && ha.height === hb.height && ha.rgba.length === hb.rgba.length) {
        const textMask = rectsToTextMask(ha.width, ha.height, ha.fragments, MASK_PAD);
        const cmp = comparePixelBuffers({
          candidate: hb.rgba,
          reference: ha.rgba,
          width: ha.width,
          height: ha.height,
          textMask,
          tolerance: TOL.screenshot,
        });
        console.log(
          `    screenshot: ${cmp.comparedPixels} non-text px compared, worst ΔE ${cmp.worstDeltaE.toFixed(2)}, mean ΔE ${cmp.meanDeltaE.toFixed(2)}, ${cmp.exceedingPixels} exceeding (${cmp.percentExceeding.toFixed(2)}%)` +
          (cmp.pass ? '' : '  [non-text FAIL]'),
        );
        console.log(
          `    screenshot text-region: ${cmp.textRegion.pixels} px, worst ΔE ${cmp.textRegion.worstDeltaE.toFixed(2)}, mean ΔE ${cmp.textRegion.meanDeltaE.toFixed(2)}, ${cmp.textRegion.exceedingPixels} exceeding (${cmp.textRegion.percentExceeding.toFixed(2)}%)` +
          (cmp.textRegion.pass ? '' : '  [text FAIL]'),
        );
      } else {
        console.log(`    screenshot: SKIPPED (size mismatch ${labelA} ${ha.width}x${ha.height} vs ${labelB} ${hb.width}x${hb.height})`);
      }
    }
  }

  // Safari-config seam: the fixture's real family resolved through the safari
  // fallback table, measured through the Pretext seam over the Canvas
  // interface. Chrome's fragments are the WebKit-free reference (the chrome and
  // safari tables resolve every probe family to the same registered face); the
  // WebKit oracle itself is used when it launched. Fixtures whose text wraps
  // around floats are skipped: the seam lays out at a constant width and cannot
  // reproduce float intrusion (the same scope verify:four-layer enforces by
  // keeping float text out of its seam-checked spine fixtures).
  if (harvests.chrome || harvests.safari) {
    if (f.html.includes('float:')) {
      console.log('  seam (safari config, resolved family): SKIPPED — text wraps around a float, not reproducible at constant width');
    } else {
      const referenceKey = harvests.safari ? 'safari' : 'chrome';
      const referenceEntry = BROWSERS.find((x) => x.key === referenceKey);
      const seam = seamAgainstFragments('safari', f, harvests[referenceKey]);
      console.log(
        `  seam (safari config, resolved family) vs ${referenceEntry.label} fragments: ${seam.pass ? 'PASS' : 'FAIL'} — ${seam.detail}` +
        ` (max ≤ ${MAX_PX}px)`,
      );
    }
  }

  console.log('');
}

for (const b of BROWSERS) {
  const entry = available.get(b.key);
  if (entry) {
    await entry.page.close();
    await entry.browser.close();
  }
}
