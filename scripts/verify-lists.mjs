#!/usr/bin/env node
/**
 * `npm run verify:lists`
 *
 * Renders every corpus/lists fixture with the engine and diffs all four layers
 * against headless Chrome (charter §2), plus the list-specific oracle:
 *   - layer-1 measureText    sub-pixel parity
 *   - layer-2 computedStyle  exact string equality (list-style-type /
 *     list-style-position / display for ul/ol/li)
 *   - layer-3 getBoundingClientRect  <= 0.5px per dimension, PLUS the
 *     first-line text x of each li via Chrome's Range.getClientRects() — the
 *     geometry that proves inside markers shift the text by the marker advance
 *     and outside markers leave it at the content box
 *   - layer-4 screenshot     per-pixel delta-E <= 2 with <= 1% exceeding
 *   - ol numbering          Chrome's `::marker` text (harvested via CDP
 *     DOMSnapshot, e.g. "1. ", "2. ", "3. ") must equal the engine's rendered
 *     counter text, including a nested ol restarting at 1
 *
 * Writes reference.json/reference.png/text-mask.png (Chrome) and
 * candidate.json/candidate.png (engine) into each fixture directory, then a
 * report under docs/reports/. Exits 0 only when every fixture passes every
 * layer and every marker's text matches Chrome.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { decodePng, encodePng } from '../dist/harness/png.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';
import { renderHtml } from '../dist/layout/render.js';
import { chromeConfig } from '../dist/config/index.js';

const corpus = resolve('corpus/lists');

function* fixtures() {
  if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`verify:lists: corpus directory missing: ${corpus}`);
    process.exit(1);
  }
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

function mergeLines(frags) {
  const groups = new Map();
  for (const f of frags) {
    const key = Math.round(f.y * 10) / 10;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const lines = [];
  for (const [key, fs] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    let minX = Infinity;
    let maxRight = -Infinity;
    for (const f of fs) {
      minX = Math.min(minX, f.x);
      maxRight = Math.max(maxRight, f.x + f.width);
    }
    lines.push({ x: minX, width: maxRight - minX });
  }
  return lines;
}

function compareLines(chromeLines, engineLines, maxPx) {
  if (chromeLines.length !== engineLines.length) {
    return { pass: false, maxDelta: Number.POSITIVE_INFINITY, lines: Math.max(chromeLines.length, engineLines.length) };
  }
  let maxDelta = 0;
  for (let k = 0; k < chromeLines.length; k++) {
    const c = chromeLines[k];
    const e = engineLines[k];
    maxDelta = Math.max(maxDelta, Math.abs(c.x - e.x), Math.abs(c.width - e.width));
  }
  return { pass: maxDelta <= maxPx, maxDelta, lines: chromeLines.length };
}

/**
 * Harvest each li's `::marker` text via CDP: the marker box's text run appears
 * in the DOMSnapshot layout tree keyed by the `::marker` pseudo's backend node.
 * Returns `{ id: text | null }` (null when the li generates no marker, e.g.
 * `list-style-type: none`).
 */
async function harvestMarkerTexts(client, ids) {
  const { root } = await client.send('DOM.getDocument', { depth: 1, pierce: true });
  const snap = await client.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includePaintOrder: true });
  const doc = snap.documents[0];
  const strings = snap.strings;
  const backendToText = new Map();
  (doc.layout?.text ?? []).forEach((idx, i) => {
    if (idx === null || typeof idx !== 'number') return;
    const text = strings[idx];
    const ni = doc.layout.nodeIndex?.[i];
    const backend = ni !== null && ni !== undefined ? doc.nodes.backendNodeId?.[ni] : undefined;
    if (text && text.trim() && backend !== undefined) backendToText.set(backend, text);
  });
  const out = {};
  for (const id of ids) {
    let marker = null;
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${id}` });
    if (nodeId !== 0) {
      const desc = await client.send('DOM.describeNode', { nodeId, depth: 0 });
      marker = desc.node.pseudoElements?.find((p) => p.pseudoType === 'marker') ?? null;
    }
    out[id] = marker ? (backendToText.get(marker.backendNodeId) ?? null) : null;
  }
  return out;
}

const tolerances = loadTolerances(resolve('tolerances.json'));
const browser = await chromium.launch();
const results = [];
const markerRows = [];
const lineRows = [];
let allPass = true;
const failures = [];

try {
  for (const { dir, name, raw } of fixtures()) {
    const h = raw.harvest;
    const viewport = h.viewport;
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const client = await page.context().newCDPSession(page);
    await page.setContent(h.html);
    await page.evaluate(() => document.fonts.ready);

    // --- Chrome oracle quantities ---
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

    // Chrome's ::marker text per li (ol numbering oracle).
    const chromeMarkerTexts = h.markerElements && h.markerElements.length > 0 ? await harvestMarkerTexts(client, h.markerElements) : {};

    const fragments = [];
    const fragmentsById = {};
    if (h.textElements && h.textElements.length > 0) {
      for (const id of h.textElements) {
        const frags = await page.evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return [];
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
        }, id);
        fragmentsById[id] = frags;
        fragments.push(...frags);
      }
    }

    const shot = await page.screenshot();
    const refImg = decodePng(shot);
    const { width, height } = refImg;
    await page.close();

    // --- engine candidate (chrome browser-config) ---
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
    const candidateComputed = out.computedStyles;
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
        { measureText: referenceMeasure, computedStyle: referenceComputed, rect: referenceRects, fragments: fragmentsById, markerTexts: chromeMarkerTexts },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify(
        { measureText: candidateMeasure, computedStyle: candidateComputed, rect: candidateRects, fragments: out.textFragments, markerTexts: out.listMarkers },
        null,
        2,
      ) + '\n',
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
    const evaluated = evaluateFixture(fixture);
    results.push(evaluated);
    if (!evaluated.checkPass) {
      allPass = false;
      failures.push(`fixture '${name}': four-layer check failed`);
    }

    let markerPass = true;
    let markerDetail = 'no marker elements';
    const markerIds = h.markerElements ?? [];
    if (markerIds.length > 0) {
      const mismatches = [];
      for (const id of markerIds) {
        const chromeText = chromeMarkerTexts[id];
        const engineText = out.listMarkers[id] ?? null;
        const c = chromeText === null ? null : chromeText.trim();
        const e = engineText === null ? null : engineText.trim();
        if (e !== null) {
          if (c !== e) mismatches.push(`${id}: Chrome "${c}" vs engine "${e}"`);
        } else if (c !== null && /^\d/.test(c)) {
          // Chrome generated a counter marker but the engine produced none.
          mismatches.push(`${id}: Chrome counter "${c}" but engine has no marker text`);
        }
      }
      markerPass = mismatches.length === 0;
      markerDetail = mismatches.length === 0 ? `all ${markerIds.length} marker text(s) match Chrome` : mismatches.join('; ');
      markerRows.push({ name, pass: markerPass, detail: markerDetail });
      if (!markerPass) {
        allPass = false;
        failures.push(`fixture '${name}': ol marker numbering — ${markerDetail}`);
      }
    }

    // --- line-box geometry (inside-marker shift oracle) ---
    let linePass = true;
    let lineDetail = 'no text elements';
    const textIds = h.textElements ?? [];
    if (textIds.length > 0) {
      const maxPx = tolerances.layers.rect.maxPx;
      let worst = 0;
      let totalLines = 0;
      for (const id of textIds) {
        const chrome = mergeLines(fragmentsById[id] ?? []);
        const engine = mergeLines((out.textFragments[id] ?? []).map((f) => ({ x: f.x, y: f.y, width: f.width, height: f.height })));
        totalLines += Math.max(chrome.length, engine.length);
        const cmp = compareLines(chrome, engine, maxPx);
        worst = Math.max(worst, cmp.maxDelta);
        if (!cmp.pass) linePass = false;
      }
      lineDetail = `max Δ ${worst === Number.POSITIVE_INFINITY ? '∞' : worst.toFixed(4)}px over ${totalLines} line box(es) (≤ ${maxPx}px)`;
      lineRows.push({ name, pass: linePass, maxDelta: worst, lines: totalLines, detail: lineDetail });
      if (!linePass) {
        allPass = false;
        failures.push(`fixture '${name}': line-box geometry — ${lineDetail}`);
      }
    }

    console.log(
      `verified ${name}: ${width}x${height}, ${fragments.length} text fragments, ` +
        `markers ${markerPass ? 'PASS' : 'FAIL'} (${markerDetail})` +
        `, lines ${linePass ? 'PASS' : 'FAIL'} (${lineDetail})`,
    );
  }
} finally {
  await browser.close();
}

if (results.length === 0) {
  console.error(`verify:lists: no fixtures found under ${corpus}`);
  process.exit(1);
}

const report = buildReport(results, { fixtureSet: 'corpus/lists', tolerancesVersion: tolerances.version });
const outDir = writeReport(report);
console.log(renderMarkdown(report));
if (markerRows.length > 0) {
  console.log('ol marker numbering (::marker text vs engine):');
  for (const r of markerRows) console.log(`  ${r.name}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
}
if (lineRows.length > 0) {
  console.log('Line-box geometry (layer-3, per text element):');
  for (const r of lineRows) {
    console.log(`  ${r.name}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
  }
}
const ok = report.allChecksPass && markerRows.every((r) => r.pass) && lineRows.every((r) => r.pass);
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
if (!ok) {
  for (const f of failures) console.log(`      - ${f}`);
}
process.exit(ok ? 0 : 1);
