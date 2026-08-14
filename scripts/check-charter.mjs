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

// --- charter content assertions ---
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

if (failed) {
  console.error('check-charter: FAIL — see errors above');
  process.exit(1);
}
console.log('check-charter: PASS — charter ratified and runtime within pin');
