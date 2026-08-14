#!/usr/bin/env node
/**
 * `npm run verify:segmenter`
 *
 * Pins the segmentation runtime (charter §6) and proves segmentation parity
 * between Node's ICU and the Playwright Chrome oracle's ICU for
 * corpus/segmenter-icu/:
 *
 *   - fails fast when the Node floor (<20) is missed, `Intl.Segmenter` is
 *     missing, or ICU data is small (only a subset of locales supported);
 *   - per-string grapheme segmentation: segment count and boundaries must be
 *     identical in Node and Chrome (`Intl.Segmenter`, grapheme granularity);
 *   - Pretext prepare+layout over the same corpus (segments, line count, and
 *     per-line texts) must be identical in Node and Chrome — the real consumer
 *     of `Intl.Segmenter` at grapheme granularity, so a divergence in cluster
 *     boundaries shows up as a wrap-point shift in `layout()`;
 *   - records `process.versions.icu`, the Chrome/Chromium version, and the
 *     Chrome ICU data version (parsed from the oracle's `icudtl.dat`) plus the
 *     run result into docs/ledgers/icu.md.
 *
 * A fixture may declare a typed gap on a layer (`expected.<layer>:
 * { result:'fail', reason, sunset }`, see scripts/lib/expected.mjs) for
 * documented divergences: every such entry needs a `reason`, and the script
 * asserts each still diverges (so a closed gap surfaces for reclassification
 * into the pass corpus).
 *
 * Exits 0 only when every pass entry segments and lays out identically, every
 * documented gap still diverges, and the ledger is written.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { setLocale } from '@chenglou/pretext';
import { installPretextMeasurement, layoutLines, prepareText, segmentGraphemes } from '../dist/pretext/index.js';
import { getMeasurementCanvas } from '../dist/layout/measure.js';
import { skiaCanvasFactory } from '../dist/canvas/index.js';
import { gapLayers, expectedLabel } from './lib/expected.mjs';

const corpus = resolve('corpus/segmenter-icu');
const ledgerPath = resolve('docs/ledgers/icu.md');
/** line-height for the Pretext layout() check. */
const LINE_HEIGHT = 24;

// --- runtime pin (charter §6): fail fast ---
function failFast(message) {
  console.error(`verify:segmenter: FAIL - ${message}`);
  process.exit(1);
}
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10);
if (!Number.isInteger(nodeMajor) || nodeMajor < 20) {
  failFast(`Node floor is >=20 (running ${process.versions.node})`);
}
if (!process.versions.icu) {
  failFast('full-icu data missing (process.versions.icu is empty)');
}
if (typeof Intl.Segmenter !== 'function') {
  failFast('Intl.Segmenter is required and unavailable');
}
const fullIcuLocales = ['en', 'hi', 'ja', 'zh'];
const supportedLocales = Intl.Segmenter.supportedLocalesOf(fullIcuLocales);
if (supportedLocales.length !== fullIcuLocales.length) {
  failFast(
    `ICU data appears small: Intl.Segmenter.supportedLocalesOf([${fullIcuLocales.join(', ')}]) ` +
      `returned [${supportedLocales.join(', ')}] (full-icu expected)`,
  );
}
console.log(`verify:segmenter: runtime pin OK — node ${process.versions.node}, icu ${process.versions.icu}`);

// --- corpus ---
function* fixtures() {
  if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
    failFast(`corpus directory missing: ${corpus}`);
  }
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fpath = join(corpus, entry.name, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

// --- register the corpus font set into the engine Canvas interface ---
const registeredFamilies = new Set();
const fixtureList = [...fixtures()];
if (fixtureList.length === 0) {
  failFast(`no fixtures found under ${corpus}`);
}
for (const { raw } of fixtureList) {
  for (const f of raw.fonts ?? []) {
    if (!statSync(f.file, { throwIfNoEntry: false })?.isFile()) {
      failFast(`fixture references missing font file: ${f.file}`);
    }
    if (registeredFamilies.has(f.family)) continue;
    try {
      skiaCanvasFactory.registerFont(f.file, f.family);
    } catch (err) {
      failFast(`font registration failed for '${f.family}': ${err.message}`);
    }
    registeredFamilies.add(f.family);
  }
}
installPretextMeasurement(getMeasurementCanvas());
setLocale('en');

/** Escaped text so control chars stay readable in the ledger. */
const controlRe = new RegExp('[\\x00-\\x1f\\x7f]', 'u');
const esc = (s) => (controlRe.test(s) ? JSON.stringify(s) : s);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

// --- oracle versions (for the ledger), captured before the browser closes ---
const chromiumVersion = browser.version();
let chromeIcuData = null;
try {
  const icuFile = join(dirname(chromium.executablePath()), 'icudtl.dat');
  const buf = readFileSync(icuFile);
  if (buf[2] === 0xda && buf[3] === 0x27) {
    chromeIcuData = {
      dataFormat: buf.toString('latin1', 12, 16),
      formatVersion: `${buf[16]}.${buf[17]}.${buf[18]}.${buf[19]}`,
      dataVersion: `${buf[20]}.${buf[21]}.${buf[22]}.${buf[23]}`,
    };
  }
} catch {
  chromeIcuData = null;
}

let allPass = true;
const failures = [];
const categoryRows = []; // { name, expected, strings, segPass, layoutPass, detail }
const stringRows = []; // { category, text, graphemes, segPass, layoutPass, expected }

try {
  // --- layer 1: raw grapheme segmentation parity (Node vs Chrome) ---
  const allTexts = fixtureList.flatMap(({ raw }) => (raw.entries ?? []).map((e) => e.text));
  const chromeSegments = await page.evaluate((texts) => {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const out = {};
    for (const t of texts) out[t] = [...seg.segment(t)].map((s) => s.segment);
    return out;
  }, allTexts);

  const nodeSegments = {};
  for (const t of allTexts) nodeSegments[t] = segmentGraphemes(t);

  // --- layer 2: Pretext prepare+layout parity (Node vs Chrome) ---
  // Serve the repo so the browser can import the real @chenglou/pretext ESM
  // (same package the engine runs) and lay out the same corpus strings.
  const mime = { '.js': 'text/javascript', '.json': 'application/json' };
  const server = createServer((req, res) => {
    const path = join(resolve('.'), decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    try {
      const st = statSync(path);
      if (st.isDirectory()) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': mime[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream' });
      res.end(readFileSync(path));
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await page.goto(`${baseUrl}/`);

  const layoutRequests = fixtureList.flatMap(({ raw }) =>
    (raw.entries ?? []).map((e) => ({
      text: e.text,
      font: raw.layout?.font ?? "16px 'Noto Sans'",
      maxWidth: raw.layout?.maxWidth ?? 800,
    })),
  );
  const chromeLayout = await page.evaluate(async ({ baseUrl, requests }) => {
    const mod = await import(`${baseUrl}/node_modules/@chenglou/pretext/dist/layout.js`);
    mod.setLocale('en');
    const out = {};
    for (const { text, font, maxWidth } of requests) {
      const prepared = mod.prepareWithSegments(text, font);
      const lines = [];
      mod.walkLineRanges(prepared, maxWidth, (line) => {
        lines.push(mod.materializeLineRange(prepared, line).text);
      });
      out[text] = {
        segments: prepared.segments,
        lineCount: mod.layout(prepared, maxWidth, 24).lineCount,
        lines,
      };
    }
    return out;
  }, { baseUrl, requests: layoutRequests });

  const nodeLayout = {};
  for (const { text, font, maxWidth } of layoutRequests) {
    const prepared = prepareText(text, font);
    const res = layoutLines(prepared, maxWidth, LINE_HEIGHT);
    nodeLayout[text] = {
      segments: prepared.segments,
      lineCount: res.lineCount,
      lines: res.lines.map((l) => l.text),
    };
  }
  server.close();

  // --- per-entry checks ---
  for (const { name, raw } of fixtureList) {
    const isGapFixture = gapLayers(raw.expected).length > 0;
    const entries = raw.entries ?? [];
    if (entries.length === 0) {
      failFast(`fixture '${name}' has no entries`);
    }
    let catStrings = 0;
    let catSegPass = true;
    let catLayoutPass = true;
    const details = [];
    for (const e of entries) {
      const node = nodeSegments[e.text];
      const chrome = chromeSegments[e.text];
      if (!node || !chrome) {
        failFast(`fixture '${name}': entry text missing from comparison output`);
      }
      const segPass = node.length === chrome.length && node.every((g, i) => g === chrome[i]);
      const nodeL = nodeLayout[e.text];
      const chromeL = chromeLayout[e.text];
      const layoutPass =
        nodeL &&
        chromeL &&
        JSON.stringify(nodeL.segments) === JSON.stringify(chromeL.segments) &&
        nodeL.lineCount === chromeL.lineCount &&
        JSON.stringify(nodeL.lines) === JSON.stringify(chromeL.lines);

      catStrings++;
      stringRows.push({
        category: name,
        text: e.text,
        graphemes: node.length,
        segPass,
        layoutPass,
        expected: isGapFixture ? 'fail' : 'pass',
        reason: e.reason ?? '',
      });

      if (isGapFixture) {
        if (!e.reason) {
          failFast(`fixture '${name}': expected:fail entries need a 'reason'`);
        }
        const stillDiverges = !segPass || !layoutPass;
        if (!stillDiverges) {
          allPass = false;
          catSegPass = false;
          catLayoutPass = false;
          details.push(`entry ${esc(e.text)} no longer diverges (reclassify into the pass corpus)`);
        }
      } else {
        if (!segPass) {
          allPass = false;
          catSegPass = false;
          details.push(
            `grapheme mismatch on ${esc(e.text)}: node ${node.length} clusters, chrome ${chrome.length} — ` +
              `node [${node.join(' | ')}], chrome [${chrome.join(' | ')}]`,
          );
        }
        if (!layoutPass) {
          allPass = false;
          catLayoutPass = false;
          details.push(
            `pretext layout mismatch on ${esc(e.text)}: node lineCount=${nodeL?.lineCount} chrome lineCount=${chromeL?.lineCount}`,
          );
        }
      }
    }

    const checkPass = catSegPass && catLayoutPass;
    const detail = details.length > 0 ? details.join('; ') : 'segments + layout identical';
    categoryRows.push({ name, expected: expectedLabel(raw.expected), strings: catStrings, segPass: catSegPass, layoutPass: catLayoutPass, detail });
    if (!checkPass) failures.push(`fixture '${name}': ${detail}`);
    console.log(`  ${name}: ${checkPass ? 'PASS' : 'FAIL'} — ${catStrings} string(s), ${detail}`);
  }
} finally {
  await browser.close();
}

// --- ledger ---
const passStrings = stringRows.filter((r) => r.expected !== 'fail').length;
const gapStrings = stringRows.length - passStrings;
const segPassCount = stringRows.filter((r) => r.expected !== 'fail' && r.segPass).length;
const layoutPassCount = stringRows.filter((r) => r.expected !== 'fail' && r.layoutPass).length;
const maxGraphemes = Math.max(...stringRows.map((r) => r.graphemes));
const totalGraphemes = stringRows.reduce((s, r) => s + r.graphemes, 0);

const md = [];
md.push('# ICU Ledger');
md.push('');
md.push(
  'Runtime pin record per the charter §6: every segmentation verification run records the ICU versions in play so segmentation parity with the browser\'s ICU can be tracked. Owning seam: `src/pretext/` (`segmentGraphemes`, Pretext prepare/layout via `Intl.Segmenter`); corpus: `corpus/segmenter-icu/`; `npm run verify:segmenter`.',
);
md.push('');
md.push('## Current pin');
md.push('');
md.push('| Component | Version |');
md.push('| --- | --- |');
md.push(`| \`process.versions.icu\` (Node) | ${process.versions.icu} |`);
md.push(`| Node | ${process.versions.node} |`);
md.push(`| Chrome (Playwright oracle) | ${chromiumVersion} |`);
md.push(
  chromeIcuData
    ? `| Chrome ICU data (icudtl.dat UDataInfo) | ${chromeIcuData.dataFormat} format v${chromeIcuData.formatVersion}, data v${chromeIcuData.dataVersion} |`
    : `| Chrome ICU data (icudtl.dat) | not readable at ${dirname(chromium.executablePath())} |`,
);
md.push('| Chrome ICU library | 78.2 (chromium deps/icu @ d578f2e8…, `U_ICU_VERSION`) |');
md.push('');
md.push(
  '`Intl.Segmenter` is required by the charter; `scripts/check-charter.mjs` and `scripts/verify-segmenter.mjs` fail fast when it is missing or ICU data is small (fewer than all corpus locales supported). Pretext segments text (grapheme granularity) via `Intl.Segmenter`; segmentation parity with Chrome is proven by the segmenter corpus and the Pretext layout() check below.',
);
md.push('');
md.push('## Latest Run');
md.push('');
md.push(`- Generated: ${new Date().toISOString()}`);
md.push(`- Node ICU \`${process.versions.icu}\` vs Chrome ${chromiumVersion} ICU: **${allPass ? 'parity' : 'NOT in parity'}**`);
md.push(`- Strings segmented: ${stringRows.length} (${passStrings} pass corpus + ${gapStrings} documented gaps)`);
md.push(`- Grapheme clusters: ${totalGraphemes} (up to ${maxGraphemes} in one string)`);
md.push(`- Grapheme boundary parity (pass corpus): ${segPassCount}/${passStrings}`);
md.push(`- Pretext layout() parity (pass corpus): ${layoutPassCount}/${passStrings}`);
md.push(`- Categories: ${categoryRows.length}, all ${allPass ? 'PASS' : 'FAIL'}`);
md.push('');
md.push('## Corpus');
md.push('');
md.push('| Category | Strings | Grapheme parity | Pretext layout() parity | Result |');
md.push('|---|---|---|---|---|');
for (const c of categoryRows) {
  md.push(
    `| ${c.name} | ${c.strings} | ${c.segPass ? 'PASS' : 'FAIL'} | ${c.layoutPass ? 'PASS' : 'FAIL'} | ${c.segPass && c.layoutPass ? 'PASS' : 'FAIL'} |`,
  );
}
md.push('');
md.push('## Per-String Results');
md.push('');
md.push('| Category | String | Graphemes | Result |');
md.push('|---|---|---|---|');
for (const r of stringRows) {
  const result = r.expected === 'fail' ? 'GAP' : r.segPass && r.layoutPass ? 'PASS' : 'FAIL';
  md.push(`| ${r.category} | ${esc(r.text)} | ${r.graphemes} | ${result} |`);
}
md.push('');
md.push('## Divergences');
md.push('');
if (allPass) {
  md.push(
    'None recorded for this run — every corpus string segmented identically (Node ICU vs Chrome ICU) and laid out identically through Pretext. The typed gap-declaration fixture mechanism (expected.<layer> = { result: "fail", reason, sunset }) is the place to record Chrome-vs-Node ICU divergences in segmentation behavior when the corpus grows past the current strings.',
  );
} else {
  md.push('The following divergences were observed and documented:');
  md.push('');
  for (const r of stringRows.filter((row) => row.expected === 'fail')) {
    md.push(`- **${esc(r.text)}** (${r.category}) — ${r.reason}`);
  }
  md.push('');
  md.push('Pass-corpus failures are NOT permitted and must be fixed or reclassified into a documented gap.');
}
md.push('');

writeFileSync(ledgerPath, md.join('\n'));

const summary = [
  `verify:segmenter: ${stringRows.length} strings, grapheme parity ${segPassCount}/${passStrings}, ` +
    `pretext layout() parity ${layoutPassCount}/${passStrings}`,
  `node ${process.versions.node} (icu ${process.versions.icu}) vs chrome ${chromiumVersion}${chromeIcuData ? ` (icu data v${chromeIcuData.dataVersion})` : ''}`,
  `ledger: ${ledgerPath}`,
];
if (allPass) {
  console.log(`PASS: ${summary.join('\n      ')}`);
  process.exit(0);
}
console.log(`FAIL: ${summary.join('\n      ')}`);
for (const f of failures) console.log(`      - ${f}`);
process.exit(1);
