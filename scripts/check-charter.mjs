#!/usr/bin/env node
/**
 * `node scripts/check-charter.mjs`
 *
 * Assert docs/charter.md contains the four-layer parity model and tolerance
 * values, the browser-config contract, the input contract, the runtime pin, and
 * the corpus layout (the nonbrowser-spec task's acceptance check). Also fails
 * fast when the runtime is below the charter floor: Node >= 20 with full ICU
 * and Intl.Segmenter.
 *
 * Also enforces the typed per-layer fixture `expected` schema (improvement-plan
 * §4): the top-level string `"fail"` shorthand is retired, every layer value is
 * either `'pass'` or a typed gap declaration `{ result:'fail', reason, sunset }`,
 * and a gap without a non-empty `reason` or `sunset` fails the check. Exit 0 =
 * charter in force and corpus gap schema clean.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LAYER_NAMES, isGapExpectation } from './lib/expected.mjs';

const SRC_DIR = resolve('src');

let failed = false;
const fail = (msg) => {
  console.error(`check-charter: FAIL - ${msg}`);
  failed = true;
};

// --- runtime pin (charter §6) ---
const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (!Number.isInteger(major) || major < 20) {
  fail(`runtime below Node >=20 floor (running ${process.versions.node})`);
}
if (!process.versions.icu) {
  fail('full-icu data missing (process.versions.icu is empty)');
} else {
  console.log(`check-charter: icu ${process.versions.icu} (node ${process.versions.node})`);
}
if (typeof Intl.Segmenter !== 'function') {
  fail('Intl.Segmenter is required (charter §6) and unavailable');
}

const charter = readFileSync(resolve('docs/charter.md'), 'utf8');

const requires = [
  ['four-layer parity model', /Four-Layer Parity Model/],
  ['measureText layer tolerance', /measureText/],
  ['getComputedStyle exact equality', /getComputedStyle/],
  ['getBoundingClientRect <=0.5px', /getBoundingClientRect/],
  ['screenshot delta-E <=2', /delta-E/],
  ['<=1% of pixels exceeding', /1% of pixels/],
  ['browser-config contract', /browser-config/],
  ['chrome first / firefox later / safari parked', /firefox/],
  ['input contract HTML + CSS strings', /HTML \+ CSS strings/],
  ['@ace-code/shast renderComponent input', /renderComponent/],
  ['runtime pin Node >=20 full-icu', /Node `>=20` with full-icu|Node `>=20`|Node >=20/],
  ['Intl.Segmenter required', /Intl\.Segmenter/],
  ['corpus layout corpus/<feature>/', /corpus\/<feature>\//],
  ['Playwright as test-only oracle', /test-only oracle/],
];

for (const [label, re] of requires) {
  if (!re.test(charter)) fail(`charter.md missing: ${label}`);
}

// --- corpus gap-fixture schema (improvement-plan §4) ---
// Every fixture's `expected` must use the single typed per-layer form: a layer
// value is either 'pass' or { result:'fail', reason, sunset }. The retired
// top-level string "fail" shorthand and any gap missing reason/sunset fail here.
function* walkFixtureFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFixtureFiles(p);
    else if (entry.isFile() && entry.name === 'fixture.json') yield p;
  }
}

function gapSchemaErrors(fpath) {
  const raw = JSON.parse(readFileSync(fpath, 'utf8'));
  const expected = raw.expected;
  const errors = [];
  if (expected === undefined) return errors;
  if (typeof expected === 'string') {
    errors.push(`top-level expected shorthand "${expected}" is retired; use the typed per-layer object form`);
    return errors;
  }
  if (expected === null || typeof expected !== 'object' || Array.isArray(expected)) {
    errors.push('expected must be an object keyed by layer name');
    return errors;
  }
  for (const layer of LAYER_NAMES) {
    const ex = expected[layer];
    if (ex === undefined) continue;
    if (ex === 'pass') continue;
    if (typeof ex === 'string') {
      errors.push(`expected.${layer} bare "${ex}" shorthand is retired; use a typed gap object { result:'fail', reason, sunset }`);
      continue;
    }
    if (ex === null || typeof ex !== 'object' || Array.isArray(ex)) {
      errors.push(`expected.${layer} must be 'pass' or a typed gap object`);
      continue;
    }
    if (ex.result === 'fail') {
      if (typeof ex.reason !== 'string' || ex.reason.trim() === '') {
        errors.push(`expected.${layer} gap needs a non-empty 'reason'`);
      }
      if (typeof ex.sunset !== 'string' || ex.sunset.trim() === '') {
        errors.push(`expected.${layer} gap needs a non-empty 'sunset'`);
      }
    } else {
      errors.push(`expected.${layer} result must be 'pass' or 'fail' (got ${JSON.stringify(ex.result)})`);
    }
  }
  for (const key of Object.keys(expected)) {
    if (!LAYER_NAMES.includes(key)) errors.push(`unknown expected layer "${key}"`);
  }
  return errors;
}

const corpusRoot = resolve('corpus');
let gapCount = 0;
if (!statSync(corpusRoot, { throwIfNoEntry: false })?.isDirectory()) {
  fail(`corpus directory missing: ${corpusRoot}`);
} else {
  for (const fpath of walkFixtureFiles(corpusRoot)) {
    const rel = fpath.replace(process.cwd() + '/', '');
    for (const err of gapSchemaErrors(fpath)) fail(`${rel}: ${err}`);
    const raw = JSON.parse(readFileSync(fpath, 'utf8'));
    for (const layer of LAYER_NAMES) {
      if (isGapExpectation(raw.expected?.[layer])) gapCount++;
    }
  }
  if (!failed) {
    console.log(
      `check-charter: corpus gap schema clean — ${gapCount} typed gap declaration(s), all with reason+sunset`,
    );
  }
}

// --- coverage matrix (charter §11) ---
// Enforce the coverage matrix's presence and consistency so the charter and the
// corpus cannot drift apart silently:
//   - the matrix table must exist (heading + header row) and every data row
//     must have exactly the columns Feature | Property | Implemented | Tested | Token;
//   - `Implemented: yes` requires the Token to appear in the engine source
//     (src/**/*.ts) — you cannot claim a property the engine does not reference;
//   - every corpus dir listed under Tested must exist under corpus/ and contain
//     at least one fixture whose harvest.html exercises the Token — so removing
//     a fixture that covered a claimed property (or renaming the corpus) fails
//     here rather than silently narrowing the corpus.
function* walkTsFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkTsFiles(p);
    else if (entry.isFile() && entry.name.endsWith('.ts')) yield p;
  }
}

function tokenInSource(token) {
  for (const p of walkTsFiles(SRC_DIR)) {
    if (readFileSync(p, 'utf8').includes(token)) return true;
  }
  return false;
}

function tokenInCorpusDir(corpusDir, token) {
  const root = resolve(corpusDir);
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) return null;
  for (const fpath of walkFixtureFiles(root)) {
    if (readFileSync(fpath, 'utf8').includes(token)) return true;
  }
  return false;
}

const matrixMarker = /^##\s+11\.\s+Coverage Matrix/m;
const matrixLines = [];
{
  const lines = charter.split('\n');
  const start = lines.findIndex((l) => matrixMarker.test(l));
  if (start === -1) {
    fail('charter.md missing: coverage matrix (§11)');
  } else {
    let i = start + 1;
    while (i < lines.length && !/^##\s/.test(lines[i])) {
      const t = lines[i].trim();
      if (t.startsWith('|')) matrixLines.push(lines[i]);
      i++;
    }
    const headerIdx = matrixLines.findIndex((l) => /^\|\s*Feature\s*\|\s*Property\s*\|\s*Implemented\s*\|\s*Tested/m.test(l));
    if (headerIdx === -1) {
      fail('coverage matrix (§11) missing its Feature|Property|Implemented|Tested|Token header row');
    } else {
      const rows = matrixLines.slice(headerIdx + 1).filter((l) => !/^\|\s*:?-{2,}/.test(l.trim()));
      if (rows.length === 0) {
        fail('coverage matrix (§11) has no data rows');
      }
      for (const row of rows) {
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter((c, idx) => !(idx === 0 && c === '') && !(idx === row.split('|').length - 1 && c === ''));
        const [feature, property, implemented, tested, token] = cells;
        if (cells.length !== 5) {
          fail(`coverage matrix row malformed (${cells.length} cells, want 5): ${row.trim()}`);
          continue;
        }
        if (implemented !== 'yes' && implemented !== 'no') {
          fail(`coverage matrix row '${feature} ${property}': Implemented must be yes/no (got '${implemented}')`);
        }
        if (implemented === 'yes' && !tokenInSource(token)) {
          fail(`coverage matrix row '${feature} ${property}': Implemented=yes but token '${token}' not found in src/**/*.ts`);
        }
        if (tested !== '-' && tested !== '') {
          for (const dir of tested.split(',').map((d) => d.trim()).filter(Boolean)) {
            const covered = tokenInCorpusDir(dir, token);
            if (covered === null) {
              fail(`coverage matrix row '${feature} ${property}': tested corpus dir '${dir}' does not exist under corpus/`);
            } else if (!covered) {
              fail(`coverage matrix row '${feature} ${property}': tested corpus dir '${dir}' has no fixture whose harvest.html exercises token '${token}'`);
            }
          }
        }
      }
    }
  }
}

if (failed) {
  console.error('check-charter: FAIL — see errors above');
  process.exit(1);
}
console.log('check-charter: PASS — charter ratified and runtime within pin');
