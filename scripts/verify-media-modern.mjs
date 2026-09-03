#!/usr/bin/env node
/**
 * `npm run verify:media-modern`
 *
 * css-media-queries-4 range syntax and the modern feature set (hover,
 * any-hover, pointer, any-pointer, prefers-contrast, forced-colors,
 * color-gamut, update). Renders every corpus/media-modern fixture with the
 * engine and diffs the layer-2 oracle (getComputedStyle, exact string
 * equality) against headless Chrome given identical MediaEnvironment inputs.
 *
 * Emulation mapping (viewport entry -> Chrome + engine):
 *   - width/height: the page viewport.
 *   - touch: true — CDP touch + mobile emulation flips hover->none and
 *     pointer->coarse in Chrome; the engine gets the same values as explicit
 *     MediaEnvironment inputs.
 *   - prefersContrast / forcedColors / colorGamut — CDP
 *     Emulation.setEmulatedMedia feature overrides plus the same engine input.
 *   - This headless shell ignores hover/pointer/update overrides given
 *     directly to setEmulatedMedia (documented in docs/ledgers/media-modern.md):
 *     the touch path is how hover/pointer flip, and update stays at the
 *     desktop default (fast) for both engines.
 *
 * Writes reference.json/candidate.json into each fixture directory and a
 * report under docs/reports/media-modern/. Exits 0 only when every fixture
 * x viewport combination matches.
 */

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderHtml } from '../dist/layout/render.js';

const FONT_FILE = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Noto Sans';

const corpus = resolve('corpus/media-modern');
if (!statSync(corpus, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`verify:media-modern: corpus directory missing: ${corpus}`);
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

    const viewportData = [];
    let totalProps = 0;
    let totalMismatches = 0;

    for (let vi = 0; vi < viewports.length; vi++) {
      const vp = viewports[vi];
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      });
      const cdp = await page.context().newCDPSession(page);
      const emulatedFeatures = [];
      if (vp.prefersContrast) emulatedFeatures.push({ name: 'prefers-contrast', value: vp.prefersContrast });
      if (vp.forcedColors) emulatedFeatures.push({ name: 'forced-colors', value: vp.forcedColors });
      if (vp.colorGamut) emulatedFeatures.push({ name: 'color-gamut', value: vp.colorGamut });
      if (emulatedFeatures.length > 0) {
        await cdp.send('Emulation.setEmulatedMedia', { features: emulatedFeatures });
      }
      const emulateMedia = {};
      if (vp.prefersColorScheme) emulateMedia.colorScheme = vp.prefersColorScheme;
      if (vp.prefersReducedMotion) emulateMedia.reducedMotion = vp.prefersReducedMotion;
      if (Object.keys(emulateMedia).length > 0) await page.emulateMedia(emulateMedia);
      if (vp.touch) {
        // This headless shell honors touch emulation (not hover/pointer media
        // overrides): it flips hover->none and pointer->coarse, any-* with them.
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: true,
        });
      }
      await page.setContent(h.html);
      await page.evaluate(() => document.fonts.ready);

      const reference = await harvestComputed(page, specs);
      await page.close();

      const engineMedia = {
        prefersColorScheme: vp.prefersColorScheme,
        prefersReducedMotion: vp.prefersReducedMotion,
        dppx: vp.dppx,
        prefersContrast: vp.prefersContrast,
        forcedColors: vp.forcedColors,
        colorGamut: vp.colorGamut,
      };
      if (vp.touch) {
        engineMedia.hover = 'none';
        engineMedia.anyHover = 'none';
        engineMedia.pointer = 'coarse';
        engineMedia.anyPointer = 'coarse';
      }

      const out = renderHtml(h.html, {
        width: vp.width,
        height: vp.height,
        fontFamily: FONT_FAMILY,
        fontFile: FONT_FILE,
        computedStyle: specs,
        media: engineMedia,
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
          `${vp.touch ? ' touch' : ''}` +
          `${vp.prefersContrast ? ` contrast=${vp.prefersContrast}` : ''}` +
          `${vp.forcedColors ? ` forcedColors=${vp.forcedColors}` : ''}` +
          `${vp.colorGamut ? ` gamut=${vp.colorGamut}` : ''} — ${mismatches.length === 0 ? 'match' : `${mismatches.length} mismatch(es)`}`,
      );
      if (mismatches.length > 0) {
        for (const m of mismatches.slice(0, 8)) console.log(`      ${m}`);
      }
    }

    const pass = totalMismatches === 0;
    fixtureResults.push({ name, pass, totalProps, totalMismatches, viewports: viewports.length });

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
        `[${pass ? 'PASS' : 'FAIL'}]`,
    );
  }
} finally {
  await browser.close();
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportDir = join('docs/reports/media-modern', stamp);
mkdirSync(reportDir, { recursive: true });

const allPass = fixtureResults.length > 0 && fixtureResults.every((f) => f.pass);
const report = {
  generatedAt: new Date().toISOString(),
  fixtureSet: 'corpus/media-modern',
  fixtures: fixtureResults,
  checksPassed: fixtureResults.filter((f) => f.pass).length,
  totalFixtures: fixtureResults.length,
  allPass,
};
writeFileSync(join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');

const lines = [
  '# Media-Modern Verification Report',
  '',
  `- Generated: ${report.generatedAt}`,
  `- Fixture set: \`${report.fixtureSet}\``,
  '',
  '## Summary',
  '',
  `- Fixtures: ${report.totalFixtures}`,
  `- Fixtures passing: ${report.checksPassed}/${report.totalFixtures}`,
  `- Result: ${allPass ? 'PASS' : 'FAIL'}`,
  '',
  '## Fixtures',
  '',
  '| Fixture | Viewports | Props | Mismatches | Result |',
  '| --- | --- | --- | --- | --- |',
  ...fixtureResults.map((f) => `| ${f.name} | ${f.viewports} | ${f.totalProps} | ${f.totalMismatches} | ${f.pass ? 'PASS' : 'FAIL'} |`),
  '',
];
writeFileSync(join(reportDir, 'report.md'), lines.join('\n'));

console.log(allPass ? `PASS: report written to ${reportDir}` : `FAIL: report written to ${reportDir}`);
if (!allPass) process.exit(1);
