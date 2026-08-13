import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FixtureResult, LayerResult } from './evaluate.js';

export interface RegressionSummary {
  present: boolean;
  unmaskedFailed: boolean;
  maskedPassed: boolean;
}

export interface Report {
  generatedAt: string;
  tolerancesVersion: number;
  fixtureSet: string;
  fixtures: FixtureResult[];
  regression: RegressionSummary;
  checksPassed: number;
  totalFixtures: number;
  allChecksPass: boolean;
}

function formatNum(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return 'n/a';
  return n.toFixed(digits);
}

function layerDetail(r: LayerResult): string {
  switch (r.layer) {
    case 'measureText':
      return `${r.strings} string(s), mean Δ ${formatNum(r.meanDelta)}px, max Δ ${formatNum(r.maxDelta)}px`;
    case 'computedStyle':
      return `${r.props} prop(s), ${r.mismatches} mismatch(es)`;
    case 'rect':
      return `${r.boxes} box(es), ${r.dims} dim(s), max Δ ${formatNum(r.maxDelta)}px`;
    case 'screenshot':
      return `${r.comparedPixels} px compared, ${r.maskedPixels} masked, ` +
        `${r.exceedingPixels} exceeding (${formatNum(r.percentExceeding, 4)}%), ` +
        `worst ΔE ${formatNum(r.worstDeltaE)}, mean ΔE ${formatNum(r.meanDeltaE)}`;
  }
}

function layerThresholds(r: LayerResult): string {
  switch (r.layer) {
    case 'measureText':
      return `mean ≤ ${r.thresholds.meanPx}px, max ≤ ${r.thresholds.maxPx}px`;
    case 'computedStyle':
      return 'exact string equality';
    case 'rect':
      return `≤ ${r.thresholds.maxPx}px per box dimension`;
    case 'screenshot':
      return `per-pixel ΔE ≤ ${r.thresholds.deltaE}; ≤ ${r.thresholds.exceedPct}% of pixels exceeding`;
  }
}

export function buildReport(
  results: FixtureResult[],
  opts: { fixtureSet: string; tolerancesVersion: number },
): Report {
  const regression: RegressionSummary = { present: false, unmaskedFailed: false, maskedPassed: false };
  const unmasked = results.find((r) => r.name === 'regression-divergence');
  const masked = results.find((r) => r.name === 'regression-divergence-masked');
  if (unmasked && masked) {
    regression.present = true;
    regression.unmaskedFailed = unmasked.layers.screenshot.pass === false;
    regression.maskedPassed = masked.layers.screenshot.pass === true;
  }
  const checksPassed = results.filter((r) => r.checkPass).length;
  return {
    generatedAt: new Date().toISOString(),
    tolerancesVersion: opts.tolerancesVersion,
    fixtureSet: opts.fixtureSet,
    fixtures: results,
    regression,
    checksPassed,
    totalFixtures: results.length,
    allChecksPass: checksPassed === results.length && (!regression.present || (regression.unmaskedFailed && regression.maskedPassed)),
  };
}

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Harness Tolerance Report`);
  lines.push('');
  lines.push(`- Fixture set: \`${report.fixtureSet}\``);
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Tolerances version: ${report.tolerancesVersion} (defaults per charter §2)`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Fixtures: ${report.totalFixtures}`);
  lines.push(`- Fixture checks passed: ${report.checksPassed}/${report.totalFixtures}`);
  if (report.regression.present) {
    lines.push(
      `- Regression: unmasked divergence ${report.regression.unmaskedFailed ? 'FAILED (as expected)' : 'PASSED (unexpected)'}; ` +
        `masked divergence ${report.regression.maskedPassed ? 'PASSED (as expected)' : 'FAILED (unexpected)'}`,
    );
  }
  lines.push('');
  lines.push('## Fixtures');
  lines.push('');
  for (const f of report.fixtures) {
    lines.push(`### ${f.name}`);
    if (f.note) lines.push('');
    if (f.note) lines.push(`> ${f.note}`);
    lines.push('');
    lines.push('| Layer | Result | Detail | Thresholds |');
    lines.push('|---|---|---|---|');
    for (const name of ['measureText', 'computedStyle', 'rect', 'screenshot'] as const) {
      const r = f.layers[name];
      const result = r.pass ? 'PASS' : 'FAIL';
      const expected = f.expected[name];
      const marker = r.pass === (expected === 'pass') ? '' : ' (check mismatch)';
      lines.push(`| ${name} | ${result}${marker} | ${layerDetail(r)} | ${layerThresholds(r)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Write report.json + report.md under docs/reports/<timestamp>/; returns the directory. */
export function writeReport(report: Report, baseDir = 'docs/reports'): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(baseDir, stamp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(dir, 'report.md'), renderMarkdown(report));
  return dir;
}
