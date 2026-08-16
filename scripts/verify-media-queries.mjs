#!/usr/bin/env node
/**
 * `npm run verify:media-queries`
 *
 * Renders every corpus/media-queries fixture with the engine and diffs the
 * layer-2 oracle (getComputedStyle, exact string equality) against headless
 * Chrome at the same viewport. Each fixture's `harvest.viewports` array drives
 * one page per entry; the viewport dimensions plus the media-feature inputs
 * (prefers-color-scheme, prefers-reduced-motion, dppx) are applied to Chrome
 * via emulateMedia / deviceScaleFactor and to the engine via renderHtml's
 * `media` option, so both evaluate @media against the same environment.
 *
 * A fixture that declares a typed gap on `computedStyle`
 * (`expected.computedStyle: { result:'fail', reason, sunset }`) asserts the
 * *documented divergence* (the @container gap — see docs/ledgers/media-queries.md):
 * the check passes only when Chrome and the engine disagree, proving the gap is
 * real rather than silently wrong.
 *
 * Writes reference.json (Chrome) and candidate.json (engine) into each fixture
 * directory, then a report under docs/reports/media-queries/. Exits 0 only when
 * every fixture x viewport combination meets its declared expectation.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderHtml } from '../dist/layout/render.js';
import { isGapExpectation } from './lib/expected.mjs';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const corpus = resolve('corpus/media-queries');
if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:media-queries: corpus directory missing: ${corpus}`);
  process.exit(1);
}

function* fixtures() {
  for (const entry of readdirSync(corpus, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(corpus, entry.name);
    const fpath = join(dir, 'fixture.json');
    if (!statSync(fpath, { throwIfNoEntry: false })?.isFile()) continue;
    yield { dir, name: entry.name, raw: JSON.parse(readFileSync(fpath, 'utf8')) };
  }
}

async function harvestComputed(page, specs) {
  const out = {};
  for (const { id, props } of specs) {
    out[id] = await page.evaluate(
      ({ id, props }) => {
        const cs = getComputedStyle(document.getElementById(id));
        const o = {};
        for (const p of props) o[p] = cs.getPropertyValue(p);
        return o;
      },
      { id, props },
    );
  }
  return out;
}

const browser = await chromium.launch();
const fixtureResults = [];

try {
  for (const { dir, name, raw } of fixtures()) {
    const h = raw.harvest;
    const specs = h.computedStyle ?? [];
    const viewports = h.viewports ?? (h.viewport ? [h.viewport] : []);
    const computedEx = raw.expected?.computedStyle ?? 'pass';
    const expected = isGapExpectation(computedEx) ? 'fail' : 'pass';

    const viewportData = [];
    let totalProps = 0;
    let totalMismatches = 0;

    for (let vi = 0; vi < viewports.length; vi++) {
      const vp = viewports[vi];
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      });
      // The `resolution` media feature tracks the device pixel ratio. Playwright's
      // deviceScaleFactor is ignored by this headless shell, so drive it through
      // CDP device-metrics override when the fixture requests a dppx > 1.
      if (vp.dppx && vp.dppx !== 1) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: vp.dppx,
          mobile: false,
        });
      }
      await page.emulateMedia({
        colorScheme: vp.prefersColorScheme ?? 'light',
        reducedMotion: vp.prefersReducedMotion ?? 'no-preference',
      });
      await page.setContent(h.html);
      await page.evaluate(() => document.fonts.ready);

      const reference = await harvestComputed(page, specs);
      await page.close();

      const out = renderHtml(h.html, {
        width: vp.width,
        height: vp.height,
        fontFamily: FONT_FAMILY,
        fontFile: FONT_FILE,
        computedStyle: specs,
        media: {
          prefersColorScheme: vp.prefersColorScheme,
          prefersReducedMotion: vp.prefersReducedMotion,
          dppx: vp.dppx,
        },
      });
      const candidate = out.computedStyles;

      const mismatches = [];
      for (const { id, props } of specs) {
        const ref = reference[id] ?? {};
        const cand = candidate[id] ?? {};
        for (const p of props) {
          totalProps++;
          const r = ref[p];
          const c = cand[p];
          if (r !== c) {
            totalMismatches++;
            mismatches.push(`${id}.${p}: Chrome=${r} engine=${c}`);
          }
        }
      }

      viewportData.push({
        viewport: vp,
        reference,
        candidate,
        mismatches,
      });
      console.log(
        `  viewport ${vi}: ${vp.width}x${vp.height}` +
          `${vp.prefersColorScheme ? ` colorScheme=${vp.prefersColorScheme}` : ''}` +
          `${vp.prefersReducedMotion ? ` reducedMotion=${vp.prefersReducedMotion}` : ''}` +
          `${vp.dppx ? ` dppx=${vp.dppx}` : ''} — ${mismatches.length === 0 ? 'match' : `${mismatches.length} mismatch(es)`}`,
      );
      if (mismatches.length > 0) {
        for (const m of mismatches.slice(0, 8)) console.log(`      ${m}`);
      }
    }

    const pass = expected === 'fail' ? totalMismatches > 0 : totalMismatches === 0;
    fixtureResults.push({ name, expected, pass, totalProps, totalMismatches, viewports: viewports.length });

    writeFileSync(
      join(dir, 'reference.json'),
      JSON.stringify(
        {
          viewports: viewportData.map((v) => ({ viewport: v.viewport, computedStyle: v.reference })),
        },
        null,
        2,
      ) + '\n',
    );
    writeFileSync(
      join(dir, 'candidate.json'),
      JSON.stringify(
        {
          viewports: viewportData.map((v) => ({ viewport: v.viewport, computedStyle: v.candidate })),
        },
        null,
        2,
      ) + '\n',
    );

    console.log(
      `verified ${name}: ${viewports.length} viewport(s), ${totalProps} props, ${totalMismatches} mismatch(es) ` +
        `[expected ${expected} -> ${pass ? 'PASS' : 'FAIL'}]`,
    );
  }
} finally {
  await browser.close();
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = join('docs/reports/media-queries', stamp);
mkdirSync(reportDir, { recursive: true });

const allPass = fixtureResults.length > 0 && fixtureResults.every((f) => f.pass);
const report = {
  generatedAt: new Date().toISOString(),
  fixtureSet: 'corpus/media-queries',
  fixtures: fixtureResults,
  checksPassed: fixtureResults.filter((f) => f.pass).length,
  totalFixtures: fixtureResults.length,
  allPass,
};
writeFileSync(join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');

const lines = [
  '# Media-Queries Verification Report',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Fixture set: \`${report.fixtureSet}\``,
  '',
  '## Summary',
  '',
  `- Fixtures: ${report.totalFixtures}`,
  `- Fixtures passing: ${report.checksPassed}/${report.totalFixtures}`,
  '',
  '## Fixtures',
  '',
  '| Fixture | Expected | Viewports | Props | Mismatches | Result |',
  '|---|---|---|---|---|---|',
];
for (const f of fixtureResults) {
  lines.push(
    `| ${f.name} | ${f.expected} | ${f.viewports} | ${f.totalProps} | ${f.totalMismatches} | ${f.pass ? 'PASS' : 'FAIL'} |`,
  );
}
lines.push('');
writeFileSync(join(reportDir, 'report.md'), lines.join('\n') + '\n');

console.log('');
console.log(lines.join('\n'));
console.log(allPass ? `PASS: report written to ${reportDir}` : `FAIL: report written to ${reportDir}`);
process.exit(allPass ? 0 : 1);
