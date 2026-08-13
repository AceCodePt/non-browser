import { resolve } from 'node:path';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { loadFixtureSet } from '../dist/harness/fixtures.js';
import { evaluateFixture } from '../dist/harness/evaluate.js';
import { buildReport, writeReport, renderMarkdown } from '../dist/harness/report.js';

const corpus = process.argv[2] ?? 'corpus/harness-tolerances';
const tolerances = loadTolerances(resolve('tolerances.json'));
const fixtures = loadFixtureSet(resolve(corpus), tolerances);
if (fixtures.length === 0) {
  console.error(`no fixtures found under ${corpus}`);
  process.exit(1);
}

const results = fixtures.map(evaluateFixture);
const report = buildReport(results, { fixtureSet: corpus, tolerancesVersion: tolerances.version });
const outDir = writeReport(report);

console.log(renderMarkdown(report));

const ok = report.allChecksPass;
console.log(ok ? `PASS: report written to ${outDir}` : `FAIL: report written to ${outDir}`);
process.exit(ok ? 0 : 1);
