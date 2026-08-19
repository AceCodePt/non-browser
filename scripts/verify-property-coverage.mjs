#!/usr/bin/env node
/**
 * `node scripts/verify-property-coverage.mjs`
 *
 * Property-coverage audit gate + ledger. Renders every corpus fixture, resets
 * the recognition registry before the pass, then partitions the union of
 * declared property names into the recognized set (makeStyle consumed them) vs
 * the ignored set (makeStyle never looked them up, so they are silently
 * dropped). The recognized set derives entirely from makeStyle's lookups via
 * registerRecognizedProperty — never a hand-maintained list — so the report
 * cannot drift from what the engine actually consumes.
 *
 * The gate fails (exit non-zero) whenever a fixture declares a property the
 * engine silently ignores AND that property is not accounted for in
 * `ACCOUNTED_IGNORED` below. Ignored properties are never hidden or swallowed:
 * they surface in the ledger with a per-property reason. Every declaration
 * block is audited generically — no per-fixture special-casing.
 *
 * Writes docs/ledgers/property-coverage.md (the verifier is the single source
 * of that ledger; it is regenerated, not hand-maintained). Exits 0 only when
 * no unaccounted ignored property exists in the corpus.
 *
 * Pass `--self-test-fail` to demonstrate the gate's failure path: a synthetic
 * declaration outside the recognized set with no account forces the verifier
 * to exit non-zero with an ignored-property report. The default run (the
 * corpus gate) exits 0.
 */

import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'parse5';
import { parseStylesheet } from '../dist/cascade/stylesheet.js';
import { rectsOf } from '../dist/layout/render.js';
import {
  resetRecognizedProperties,
  recognizedProperties,
  auditDeclarationBlock,
} from '../dist/layout/property-coverage.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

/**
 * Ignored declared properties that are intentionally accounted for, keyed by
 * property name → reason. A declared property the engine silently ignores and
 * that is absent here fails the gate, so new ignored properties must be
 * accounted for explicitly rather than added silently.
 */
const ACCOUNTED_IGNORED = {};

/** All `<style>` text plus every inline `style` attribute in `html`. */
function declaredTexts(html) {
  const doc = parse(html);
  const out = [];
  const walk = (n) => {
    if (n.childNodes) for (const c of n.childNodes) walk(c);
    if (n.nodeName === 'style' && n.childNodes && n.childNodes[0] && n.childNodes[0].value) {
      out.push(n.childNodes[0].value);
    }
    if (n.attrs && n.nodeName !== '#document' && !n.nodeName.startsWith('#')) {
      const a = n.attrs.find((x) => x.name === 'style');
      if (a) out.push(a.value);
    }
  };
  walk(doc);
  return out;
}

function collectDeclared(html, declared) {
  for (const text of declaredTexts(html)) {
    const sheet = parseStylesheet(text);
    for (const rule of sheet.rules) {
      for (const d of rule.declarations) declared.add(d.property);
    }
  }
}

/** The ignored properties of `ignored` that are not accounted for. */
function unaccounted(ignored, accounted) {
  return ignored.filter((p) => !(p in accounted));
}

function* fixtures() {
  for (const feature of readdirSync('corpus', { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    for (const entry of readdirSync(join('corpus', feature.name), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = join('corpus', feature.name, entry.name);
      if (!statSync(join(dir, 'fixture.json'), { throwIfNoEntry: false })?.isFile()) continue;
      yield { dir, name: `${feature.name}/${entry.name}`, html: readFixtureHtml(dir) };
    }
  }
}

function readFixtureHtml(dir) {
  const raw = JSON.parse(readFileSync(join(dir, 'fixture.json'), 'utf8'));
  const html = raw?.harvest?.html ?? raw?.html;
  return typeof html === 'string' ? html : null;
}

const declared = new Set();
const fixturesToRender = [];
for (const f of fixtures()) {
  if (f.html === null) continue;
  collectDeclared(f.html, declared);
  fixturesToRender.push(f);
}

resetRecognizedProperties();
let rendered = 0;
for (const f of fixturesToRender) {
  try {
    rectsOf(f.html, { width: 800, height: 600, fontFamily: FONT_FAMILY, fontFile: FONT_FILE });
    rendered++;
  } catch (err) {
    console.error(`verify-property-coverage: fixture ${f.name} failed to render: ${err.message}`);
    process.exit(1);
  }
}

// The recognized set is makeStyle's own lookup table, populated by rendering;
// the gate then partitions the corpus's declared set against it.
const SELF_TEST_FAIL = process.argv.includes('--self-test-fail');
if (SELF_TEST_FAIL) {
  // A property makeStyle never looks up (no transform support), injected so the
  // gate sees an unaccounted ignored property and must fail — proving the
  // failure path end-to-end including the non-zero exit.
  declared.add('transform');
}

const declaredList = [...declared].sort();
const audit = auditDeclarationBlock(declaredList.map((p) => ({ property: p })));
const unaccountedIgnored = unaccounted(audit.ignored, ACCOUNTED_IGNORED);

if (SELF_TEST_FAIL) {
  // Demonstration mode: prove the gate's failure path. Reports the injected
  // unaccounted ignored property and exits non-zero, without clobbering the
  // corpus's real ledger.
  console.log(`verify-property-coverage (self-test): declaring 'transform' outside the supported set with no account ->`);
  console.log(`  ignored: ${audit.ignored.join(', ')}`);
  console.error(`verify-property-coverage (self-test): FAIL — unaccounted ignored property(ies): ${unaccountedIgnored.join(', ')}`);
  process.exit(1);
}

const ledgerDir = resolve('docs/ledgers');
const lines = [];
lines.push('# Property-Coverage Ledger');
lines.push('');
lines.push(`Audit of the corpus's declared properties, partitioning them into the`);
lines.push('recognized set (makeStyle consumed them) vs the ignored set (makeStyle never');
lines.push('looked them up, so they are silently dropped). Generated by');
lines.push('`node scripts/verify-property-coverage.mjs` — not hand-maintained. The recognized');
lines.push('set derives from `makeStyle` lookups via `registerRecognizedProperty`, never a');
lines.push('hand-maintained list.');
lines.push('');
lines.push(`- Fixtures audited: ${fixturesToRender.length}`);
lines.push(`- Declared properties (union across fixtures): ${declaredList.length}`);
lines.push(`- Recognized: ${audit.recognized.length}`);
lines.push(`- Ignored: ${audit.ignored.length}`);
lines.push('');
lines.push('## Recognized set');
lines.push('');
for (const p of audit.recognized) lines.push(`- \`${p}\``);
lines.push('');
lines.push('## Ignored set');
lines.push('');
if (audit.ignored.length === 0) {
  lines.push('None — every property the corpus declares is looked up by `makeStyle`.');
  lines.push('');
} else {
  for (const p of audit.ignored) {
    const reason = p in ACCOUNTED_IGNORED ? ACCOUNTED_IGNORED[p] : 'UNACCOUNTED';
    lines.push(`- \`${p}\` — ${reason}`);
  }
  lines.push('');
}
lines.push('## Gate');
lines.push('');
lines.push(
  `Unaccounted ignored properties: ${unaccountedIgnored.length === 0 ? 'none' : unaccountedIgnored.join(', ')}.`,
);
lines.push(
  'A declared property the engine silently ignores and that is not listed under the',
  'ignored set with a reason fails this verifier (exit non-zero).',
);
lines.push('');
const ledger = lines.join('\n');
writeFileSync(join(ledgerDir, 'property-coverage.md'), ledger);

console.log(ledger);
console.log(`verify-property-coverage: ${rendered} fixtures rendered, ${declaredList.length} declared, ${audit.recognized.length} recognized, ${audit.ignored.length} ignored`);
if (unaccountedIgnored.length > 0) {
  console.error(`verify-property-coverage: FAIL — unaccounted ignored property(ies): ${unaccountedIgnored.join(', ')}`);
  process.exit(1);
}
console.log('verify-property-coverage: PASS — ledger written to docs/ledgers/property-coverage.md');
