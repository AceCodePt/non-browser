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
 *
 * Also enforces the charter §11 coverage matrix and its *Deferred / Not in v1*
 * table (the no-silent-absence contract): matrix rows' Implemented/Tested
 * claims must hold against src + corpus, and each Deferred row's
 * `absent`/`declared-divergence` status must match whether its token appears in
 * the engine source (comments stripped) and cites its ledger doc.
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

// The matrix check above matches raw source text, so a token in a comment
// counts as present there. The Deferred absence check needs the code-only view:
// a comment naming a skipped at-rule (e.g. `@import` in the stylesheet header)
// is documentation of an absence, not a landing — treating it as code would
// make every `absent` row impossible to satisfy.
function stripComments(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  let inStr = null;
  while (i < n) {
    const c = code[i];
    if (inStr) {
      out += c;
      if (c === '\\' && i + 1 < n) {
        out += code[i + 1];
        i += 2;
        continue;
      }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      while (i < n && code[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function tokenInSourceCode(token) {
  for (const p of walkTsFiles(SRC_DIR)) {
    if (stripComments(readFileSync(p, 'utf8')).includes(token)) return true;
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
let matrixRowCount = 0;
{
  const lines = charter.split('\n');
  const start = lines.findIndex((l) => matrixMarker.test(l));
  if (start === -1) {
    fail('charter.md missing: coverage matrix (§11)');
  } else {
    let i = start + 1;
    while (i < lines.length && !/^#{2,}\s/.test(lines[i])) {
      const t = lines[i].trim();
      if (t.startsWith('|')) matrixLines.push(lines[i]);
      i++;
    }
    const headerIdx = matrixLines.findIndex((l) => /^\|\s*Feature\s*\|\s*Property\s*\|\s*Implemented\s*\|\s*Tested/m.test(l));
    if (headerIdx === -1) {
      fail('coverage matrix (§11) missing its Feature|Property|Implemented|Tested|Token header row');
    } else {
      const rows = matrixLines.slice(headerIdx + 1).filter((l) => !/^\|\s*:?-{2,}/.test(l.trim()));
      matrixRowCount = rows.length;
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

// --- deferred / not-in-v1 table (charter §11) ---
// Enforce the no-silent-absence contract the prose section documents:
//   - `absent`: the row's token must NOT appear in the engine source
//     (comments stripped — a comment naming a skipped at-rule is not an
//     implementation), so a silent landing of the surface fails loudly;
//   - `declared-divergence`: the token MUST appear in the engine source AND
//     the row must cite its ledger doc (`docs/ledgers/*.md`), so a documented
//     divergence cannot lose its citation or its implementation.
// The first backtick token in the Absent surface column is the check token.
const deferredMarker = /^###\s+Deferred\s*\/\s*Not in v1/m;
let deferredRowCount = 0;
{
  const lines = charter.split('\n');
  const start = lines.findIndex((l) => deferredMarker.test(l));
  if (start === -1) {
    fail('charter.md missing: Deferred / Not in v1 (§11) section');
  } else {
    const deferredLines = [];
    let i = start + 1;
    while (i < lines.length && !/^#{2,}\s/.test(lines[i])) {
      const t = lines[i].trim();
      if (t.startsWith('|')) deferredLines.push(lines[i]);
      i++;
    }
    const headerIdx = deferredLines.findIndex((l) => /^\|\s*Absent surface\s*\|\s*Status\s*\|\s*Evidence/m.test(l));
    if (headerIdx === -1) {
      fail('Deferred / Not in v1 (§11) missing its Absent surface|Status|Evidence header row');
    } else {
      const rows = deferredLines.slice(headerIdx + 1).filter((l) => !/^\|\s*:?-{2,}/.test(l.trim()));
      deferredRowCount = rows.length;
      if (rows.length === 0) {
        fail('Deferred / Not in v1 (§11) has no data rows');
      }
      for (const row of rows) {
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter((c, idx) => !(idx === 0 && c === '') && !(idx === row.split('|').length - 1 && c === ''));
        const [surface, status, evidence] = cells;
        if (cells.length !== 3) {
          fail(`Deferred row malformed (${cells.length} cells, want 3): ${row.trim()}`);
          continue;
        }
        const token = surface.match(/`([^`]+)`/)?.[1];
        if (!token) {
          fail(`Deferred row '${surface}': Absent surface must name its check token in backticks`);
          continue;
        }
        if (status !== 'absent' && status !== 'declared-divergence') {
          fail(`Deferred row '${surface}': Status must be 'absent' or 'declared-divergence' (got '${status}')`);
          continue;
        }
        if (status === 'absent') {
          if (tokenInSourceCode(token)) {
            fail(`Deferred row '${surface}': Status=absent but token '${token}' found in src/**/*.ts (comments stripped)`);
          }
        } else if (!tokenInSourceCode(token)) {
          fail(`Deferred row '${surface}': Status=declared-divergence but token '${token}' not found in src/**/*.ts (comments stripped)`);
        } else if (!/docs\/ledgers\/[a-z0-9-]+\.md/.test(evidence)) {
          fail(`Deferred row '${surface}': Status=declared-divergence must cite a docs/ledgers/*.md doc in Evidence`);
        }
      }
    }
  }
}

if (failed) {
  console.error('check-charter: FAIL — see errors above');
  process.exit(1);
}
console.log(`check-charter: coverage matrix — ${matrixRowCount} data rows, ${deferredRowCount} deferred rows enforced`);
console.log('check-charter: PASS — charter ratified and runtime within pin');
