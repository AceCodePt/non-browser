#!/usr/bin/env node
/**
 * `node scripts/check-charter.mjs`
 *
 * Assert docs/charter.md contains the four-layer parity model and tolerance
 * values, the browser-config contract, the input contract, the runtime pin, and
 * the corpus layout (the nonbrowser-spec task's acceptance check). Also fails
 * fast when the runtime is below the charter floor: Node >= 20 with full ICU
 * and Intl.Segmenter. Exit 0 = charter in force.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

if (failed) {
  console.error('check-charter: FAIL — see errors above');
  process.exit(1);
}
console.log('check-charter: PASS — charter ratified and runtime within pin');
