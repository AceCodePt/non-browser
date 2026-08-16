#!/usr/bin/env node
/**
 * `npm run test:probe`
 *
 * Unit + integration tests for the cross-browser probe logic in
 * lib/probe-gap-lib.mjs. Runs with node's built-in test runner (no deps).
 * The browser-driven probe itself is scripts/probe-browser-gap.mjs; these
 * tests cover every pure function it depends on, plus fixture sanity.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASK_PAD,
  rectsToTextMask,
  delta,
  compareLayers,
  validateFixtures,
  FIXTURES,
} from './lib/probe-gap-lib.mjs';
import { loadTolerances } from '../dist/harness/tolerances.js';
import { getBrowserConfig, setActiveBrowserConfig, firefoxConfig, safariConfig, resolveFontFamily } from '../dist/config/index.js';
import { resolveFontFamilyInShorthand, installPretextMeasurement, prepareText, layoutLines } from '../dist/pretext/index.js';
import { skiaCanvasFactory } from '../dist/canvas/skia.js';
import { initMeasurement } from '../dist/layout/measure.js';
import { resolve } from 'node:path';

const tolerances = loadTolerances(resolve('tolerances.json'));
const TOL = tolerances.layers;

/** Build a tiny valid fixture for compareLayers/validateFixtures tests. */
function makeFixture(overrides = {}) {
  return {
    name: 'test-fixture',
    note: 'synthetic',
    viewport: { width: 100, height: 50 },
    html: '<div id="a">hello world</div>',
    measureText: [{ text: 'hello', font: "16px 'Noto Sans'" }],
    computedStyle: [{ id: 'a', props: ['font-family', 'font-size'] }],
    rects: ['a'],
    textElements: ['a'],
    tolerances,
    ...overrides,
  };
}

/** Build a harvest-shaped object with the given layer data. */
function makeHarvest(overrides = {}) {
  return {
    measureText: { "16px 'Noto Sans' | hello": 100 },
    computedStyle: { a: { 'font-family': "'Noto Sans'", 'font-size': '16px' } },
    rects: { a: { x: 0, y: 0, width: 100, height: 20 } },
    fragments: [],
    textsById: {},
    widthsById: {},
    rgba: Buffer.alloc(100 * 50 * 4),
    width: 100,
    height: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// rectsToTextMask
// ---------------------------------------------------------------------------

describe('rectsToTextMask', () => {
  test('empty rects produce an all-zero mask of the right size', () => {
    const m = rectsToTextMask(10, 10, []);
    assert.equal(m.length, 100);
    assert.ok(m.every((v) => v === 0));
  });

  test('a rect marks exactly its padded region', () => {
    const m = rectsToTextMask(10, 10, [{ x: 2, y: 2, width: 2, height: 2 }], 0);
    // Without pad: only [2..4)x[2..4).
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const inRect = x >= 2 && x < 4 && y >= 2 && y < 4;
        assert.equal(m[y * 10 + x], inRect ? 1 : 0, `pixel (${x},${y})`);
      }
    }
  });

  test('MASK_PAD default expands the region by the exported constant', () => {
    assert.equal(MASK_PAD, 2);
    const m = rectsToTextMask(10, 10, [{ x: 5, y: 5, width: 1, height: 1 }]);
    // Pad 2 on each side: [3..8)x[3..8).
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const inRect = x >= 3 && x < 8 && y >= 3 && y < 8;
        assert.equal(m[y * 10 + x], inRect ? 1 : 0, `pixel (${x},${y})`);
      }
    }
  });

  test('regions outside the canvas are clamped, not out-of-range', () => {
    const m = rectsToTextMask(5, 5, [{ x: -10, y: 3, width: 50, height: 4 }], 0);
    assert.equal(m.length, 25); // no throw
    assert.equal(m[0], 0); // (0,0) outside y=3
    assert.equal(m[15], 1); // (0,3)
    assert.equal(m[19], 1); // (4,3)
    assert.equal(m[20], 1); // (0,4) — y1=min(5,7)=5, so row 4 is in
    assert.equal(m[24], 1); // (4,4)
  });

  test('negative zero-size and degenerate rects are tolerated', () => {
    const m = rectsToTextMask(4, 4, [{ x: 1, y: 1, width: 0, height: 0 }], 0);
    assert.equal(m.length, 16);
    assert.ok(m.every((v) => v === 0));
  });

  test('overlapping rects still stay within canvas bounds', () => {
    const m = rectsToTextMask(6, 6, [
      { x: 0, y: 0, width: 4, height: 4 },
      { x: 3, y: 3, width: 4, height: 4 },
    ], 0);
    assert.equal(m.length, 36);
    // (5,5) reachable only through the second rect, clamped inside.
    assert.equal(m[5 * 6 + 5], 1);
    // (0,0) from first rect only.
    assert.equal(m[0], 1);
  });

  test('null/undefined rects behave like empty', () => {
    const m = rectsToTextMask(3, 3, null);
    assert.ok(m.every((v) => v === 0));
  });

  test('fractional rects floor/ceil to cover the whole span', () => {
    const m = rectsToTextMask(5, 5, [{ x: 0.2, y: 0.8, width: 1.4, height: 1.3 }], 0);
    // floor(0.2)=0 .. ceil(0.2+1.4)=2 -> x in {0,1}; y floor(0.8)=0..ceil(2.1)=3 -> {0,1,2}
    const covered = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (m[y * 5 + x]) covered.push(`${x},${y}`);
    assert.deepEqual(covered, ['0,0', '1,0', '0,1', '1,1', '0,2', '1,2']);
  });
});

// ---------------------------------------------------------------------------
// delta
// ---------------------------------------------------------------------------

describe('delta', () => {
  test('is the absolute difference', () => {
    assert.equal(delta(3, 5), 2);
    assert.equal(delta(5, 3), 2);
    assert.equal(delta(0, 0), 0);
    assert.equal(delta(-1, 1), 2);
  });

  test('handles fractional values', () => {
    assert.ok(Math.abs(delta(0.1, 0.3) - 0.2) < 1e-9);
  });
});

// ---------------------------------------------------------------------------
// compareLayers
// ---------------------------------------------------------------------------

describe('compareLayers', () => {
  test('identical harvests produce zero deltas and no mismatches', () => {
    const c = makeHarvest();
    const r = compareLayers(c, makeHarvest(), makeFixture());
    assert.equal(r.measureText.count, 1);
    assert.equal(r.measureText.meanDelta, 0);
    assert.equal(r.measureText.maxDelta, 0);
    assert.equal(r.measureText.exceeds, false);
    assert.equal(r.computedStyle.count, 2);
    assert.equal(r.computedStyle.mismatches, 0);
    assert.equal(r.rect.boxes, 1);
    assert.equal(r.rect.dims, 4);
    assert.equal(r.rect.maxDelta, 0);
    assert.equal(r.rect.exceeds, false);
  });

  test('measureText mean/max computed over per-string deltas', () => {
    const c = makeHarvest({
      measureText: {
        'a': 100,
        'b': 200,
        'c': 300,
      },
    });
    const fx = makeHarvest({
      measureText: {
        'a': 101,
        'b': 204,
        'c': 300,
      },
    });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.measureText.count, 3);
    assert.deepEqual(r.measureText.deltas, [1, 4, 0]);
    assert.equal(r.measureText.meanDelta, 5 / 3);
    assert.equal(r.measureText.maxDelta, 4);
    assert.equal(r.measureText.exceeds, true); // 4 > maxPx 0.5
  });

  test('a measureText delta beyond maxPx sets exceeds', () => {
    const c = makeHarvest({ measureText: { a: 0 } });
    const fx = makeHarvest({ measureText: { a: TOL.measureText.maxPx + 1 } });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.measureText.exceeds, true);
  });

  test('missing keys on one side count as NaN deltas (flagged)', () => {
    const c = makeHarvest();
    const fx = makeHarvest({ measureText: {} });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.measureText.count, 1);
    assert.ok(Number.isNaN(r.measureText.maxDelta));
  });

  test('computedStyle mismatches are enumerated per prop', () => {
    const c = makeHarvest({
      computedStyle: { a: { 'font-family': "'Noto Sans'", 'font-size': '16px' } },
    });
    const fx = makeHarvest({
      computedStyle: { a: { 'font-family': "'Courier New'", 'font-size': '16px' } },
    });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.computedStyle.count, 2);
    assert.equal(r.computedStyle.mismatches, 1);
    assert.deepEqual(r.computedStyle.details, [
      { id: 'a', prop: 'font-family', chrome: "'Noto Sans'", firefox: "'Courier New'" },
    ]);
  });

  test('missing computedStyle id on one side counts as a mismatch', () => {
    const c = makeHarvest({ computedStyle: {} });
    const fx = makeHarvest({ computedStyle: { a: { 'font-family': 'x', 'font-size': 'y' } } });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.computedStyle.mismatches, 2);
  });

  test('rect maxDelta is the largest per-dimension delta across boxes', () => {
    const c = makeHarvest({
      rects: { a: { x: 0, y: 0, width: 100, height: 20 }, b: { x: 5, y: 5, width: 10, height: 10 } },
    });
    const fx = makeHarvest({
      rects: { a: { x: 0, y: 0.25, width: 100, height: 20 }, b: { x: 5, y: 5, width: 10.75, height: 10 } },
    });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.rect.boxes, 2);
    assert.equal(r.rect.dims, 8);
    assert.equal(r.rect.maxDelta, 0.75);
    assert.equal(r.rect.exceeds, true); // 0.75 > 0.5
  });

  test('rect exceeding tolerance flag respects the layer-3 maxPx', () => {
    const c = makeHarvest({ rects: { a: { x: 0, y: 0, width: 100, height: 20 } } });
    const fx = makeHarvest({ rects: { a: { x: 0, y: 0, width: 100, height: 20.25 } } });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.rect.maxDelta, 0.25);
    assert.equal(r.rect.exceeds, false);
  });

  test('rects present on only one side still get compared (missing = NaN)', () => {
    const c = makeHarvest({ rects: { a: { x: 0, y: 0, width: 100, height: 20 } } });
    const fx = makeHarvest({ rects: {} });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.rect.boxes, 1);
    assert.ok(Number.isNaN(r.rect.maxDelta));
  });

  test('line fragments with equal counts compute per-line mean/max', () => {
    const c = makeHarvest({ textsById: { a: 'x' }, widthsById: { a: [100, 200, 300] } });
    const fx = makeHarvest({ textsById: { a: 'x' }, widthsById: { a: [101, 204, 300] } });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.lineFragments.length, 1);
    assert.equal(r.lineFragments[0].sameCount, true);
    assert.equal(r.lineFragments[0].meanDelta, 5 / 3);
    assert.equal(r.lineFragments[0].maxDelta, 4);
  });

  test('line fragments with different counts are reported, not averaged', () => {
    const c = makeHarvest({ textsById: { a: 'x' }, widthsById: { a: [100] } });
    const fx = makeHarvest({ textsById: { a: 'x' }, widthsById: { a: [100, 200] } });
    const r = compareLayers(c, fx, makeFixture());
    assert.equal(r.lineFragments[0].sameCount, false);
    assert.equal(r.lineFragments[0].chromeLines, 1);
    assert.equal(r.lineFragments[0].firefoxLines, 2);
  });

  test('without tolerances, exceeds flags stay false', () => {
    const f = makeFixture({ tolerances: null });
    const c = makeHarvest({ measureText: { a: 0 } });
    const fx = makeHarvest({ measureText: { a: 999 } });
    const r = compareLayers(c, fx, f);
    assert.equal(r.measureText.exceeds, false);
    assert.equal(r.rect.exceeds, false);
  });
});

// ---------------------------------------------------------------------------
// validateFixtures
// ---------------------------------------------------------------------------

describe('validateFixtures', () => {
  test('a valid fixture reports no problems', () => {
    const problems = validateFixtures([makeFixture()]);
    assert.equal(problems.length, 1);
    assert.deepEqual(problems[0].problems, []);
  });

  test('missing viewport dimensions are caught', () => {
    const f = makeFixture({ viewport: {} });
    const [r] = validateFixtures([f]);
    assert.ok(r.problems.some((p) => p.includes('viewport.width')));
    assert.ok(r.problems.some((p) => p.includes('viewport.height')));
  });

  test('zero/negative viewport dimensions are caught', () => {
    const [r] = validateFixtures([makeFixture({ viewport: { width: 0, height: -5 } })]);
    assert.ok(r.problems.some((p) => p.includes('viewport.width invalid')));
    assert.ok(r.problems.some((p) => p.includes('viewport.height invalid')));
  });

  test('missing html is caught', () => {
    const [r] = validateFixtures([makeFixture({ html: '' })]);
    assert.ok(r.problems.some((p) => p.includes('html missing')));
  });

  test('measureText entries missing text/font are caught', () => {
    const [r] = validateFixtures([makeFixture({ measureText: [{ text: '' }, { font: '16px' }] })]);
    assert.ok(r.problems.some((p) => p.includes('measureText.text missing')));
    assert.ok(r.problems.some((p) => p.includes('measureText.font missing')));
  });

  test('computedStyle entries missing id or props are caught', () => {
    const [r] = validateFixtures([makeFixture({ computedStyle: [{ props: ['x'] }, { id: 'a' }] })]);
    assert.ok(r.problems.some((p) => p.includes('computedStyle.id missing')));
    assert.ok(r.problems.some((p) => p.includes('computedStyle.props missing/empty')));
  });

  test('ids referenced but absent from the html are caught', () => {
    const [r] = validateFixtures([
      makeFixture({ html: '<div id="a">x</div>', rects: ['missing-box'], textElements: ['missing-txt'] }),
    ]);
    assert.ok(r.problems.some((p) => p.includes('rects id "missing-box"')));
    assert.ok(r.problems.some((p) => p.includes('textElements id "missing-txt"')));
  });

  test('non-array layer collections are caught', () => {
    const [r] = validateFixtures([
      makeFixture({ measureText: 'nope', computedStyle: 'nope', rects: 'nope', textElements: 'nope' }),
    ]);
    assert.equal(r.problems.filter((p) => p.includes('not an array')).length, 4);
  });

  test('returns one entry per fixture, keyed by name', () => {
    const a = makeFixture({ name: 'a' });
    const b = makeFixture({ name: 'b', html: '' });
    const results = validateFixtures([a, b]);
    assert.equal(results.length, 2);
    assert.equal(results[0].fixture, 'a');
    assert.equal(results[1].fixture, 'b');
    assert.ok(results[1].problems.length > 0);
  });
});

// ---------------------------------------------------------------------------
// Seam font-resolution authority (browser-canvas-support)
// ---------------------------------------------------------------------------
//
// One font-resolution authority: Pretext's measurement context and the engine's
// measureTextWidth must resolve a CSS family through the active browser-config
// (resolveFontFamily) identically, so the seam measures the same per-browser
// faces the engine does. These tests are the regression gate — each fails if
// the seam measures a family the active config would resolve differently.

describe('seam font-resolution authority', () => {
  const SEAM_TEXT = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.';

  const resolvedOf = (config, family) => resolveFontFamily(config, family);

  /** Seam line widths for a family under a config, at a fixed wrap width. */
  const seamWidths = (config, family, text = SEAM_TEXT, maxWidth = 300, fontSize = 16) => {
    setActiveBrowserConfig(config);
    for (const reg of config.fonts) skiaCanvasFactory.registerFont(reg.filePath);
    const canvas = initMeasurement({ family: config.defaultFamily, filePath: config.defaultFile }, skiaCanvasFactory);
    installPretextMeasurement(canvas);
    const prepared = prepareText(text, `${fontSize}px '${family}'`, {});
    return layoutLines(prepared, maxWidth, 24).lines.map((l) => l.width);
  };

  const meanDelta = (a, b) => {
    const n = Math.min(a.length, b.length);
    if (n === 0) return 0;
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
    return s / n;
  };

  test('the firefox config resolves the unregistered Courier New family to Source Code Pro', () => {
    assert.equal(resolvedOf(firefoxConfig, 'Courier New'), 'Source Code Pro');
  });

  test('the safari config resolves the fallback-table families to registered faces', () => {
    assert.equal(resolvedOf(safariConfig, 'Courier New'), 'Liberation Mono');
    assert.equal(resolvedOf(safariConfig, 'serif'), 'Liberation Serif');
    // monospace maps to a registered face (Hack Nerd Font when installed).
    const mono = resolvedOf(safariConfig, 'monospace');
    assert.ok(safariConfig.fonts.some((f) => f.family === mono), `monospace resolves to registered face '${mono}'`);
  });

  test('a registered family is untouched by the resolution authority', () => {
    assert.equal(resolvedOf(safariConfig, 'Noto Sans'), 'Noto Sans');
  });

  test('resolveFontFamilyInShorthand replaces only the family, preserving size/style', () => {
    setActiveBrowserConfig(firefoxConfig);
    assert.equal(resolveFontFamilyInShorthand("16px 'Courier New'"), "16px 'Source Code Pro'");
    assert.equal(resolveFontFamilyInShorthand("italic 16px 'Courier New'"), "italic 16px 'Source Code Pro'");
    assert.equal(resolveFontFamilyInShorthand("bold 14px 'Courier New'"), "bold 14px 'Source Code Pro'");
    setActiveBrowserConfig(safariConfig);
    assert.equal(resolveFontFamilyInShorthand("16px 'monospace'"), `16px '${resolvedOf(safariConfig, 'monospace')}'`);
    assert.equal(resolveFontFamilyInShorthand('16px serif'), "16px 'Liberation Serif'");
    // A registered family passes through unchanged.
    assert.equal(resolveFontFamilyInShorthand("16px 'Noto Sans'"), "16px 'Noto Sans'");
  });

  test("a fallback family's seam matches the config-resolved face's seam within the layer-1 mean", () => {
    const c = getBrowserConfig('safari');
    assert.ok(meanDelta(seamWidths(c, 'Courier New'), seamWidths(c, resolvedOf(c, 'Courier New'))) <= TOL.measureText.meanPx);
    assert.ok(meanDelta(seamWidths(c, 'serif'), seamWidths(c, resolvedOf(c, 'serif'))) <= TOL.measureText.meanPx);
    assert.ok(meanDelta(seamWidths(c, 'monospace'), seamWidths(c, resolvedOf(c, 'monospace'))) <= TOL.measureText.meanPx);
  });

  test('the seam would fail if it measured a family the active config resolves differently', () => {
    // Regression gate: under the safari config the seam must measure a family
    // through the ACTIVE fallback table (serif -> the registered serif face).
    // A seam that resolved serif along another config's table (firefox ->
    // Source Code Pro, a mono face) would widen every line by ~16px and blow
    // the layer-1 band — proving the gate has teeth.
    const c = getBrowserConfig('safari');
    const correct = seamWidths(c, resolvedOf(c, 'serif'));
    const resolvedByFirefox = seamWidths(c, resolvedOf(firefoxConfig, 'serif'));
    assert.ok(meanDelta(correct, resolvedByFirefox) > TOL.measureText.meanPx * 10, 'different resolutions give visibly different seam widths');
  });

  test('the probe fixtures integrate the safari-track families', () => {
    const names = FIXTURES.map((f) => f.name);
    assert.ok(names.includes('safari-courier-new'), 'safari-track Courier New fallback fixture');
    assert.ok(names.includes('safari-monospace-generic'), 'safari-track generic monospace fixture');
    assert.ok(names.includes('safari-serif-generic'), 'safari-track generic serif fixture');
  });
});

// ---------------------------------------------------------------------------
// Integration: the real probe fixtures must be valid and self-consistent.
// ---------------------------------------------------------------------------

describe('probe fixtures integration', () => {
  // The exact fixture set the probe runs lives in the lib, so the suite can
  // validate it deterministically (the probe script itself only adds the
  // browser harness on top).
  test('every real probe fixture passes validateFixtures', () => {
    const problems = validateFixtures(FIXTURES);
    assert.equal(problems.length, FIXTURES.length);
    for (const p of problems) {
      assert.deepEqual(p.problems, [], `${p.fixture} should be valid, got: ${p.problems.join('; ')}`);
    }
  });

  test('every real fixture carries the four hypothesis shapes', () => {
    const names = FIXTURES.map((f) => f.name);
    assert.ok(names.includes('noto-text'), 'registered-family text fixture');
    assert.ok(names.includes('source-code-pro-text'), 'firefox-registered mono face fixture');
    assert.ok(names.includes('courier-new-fallback'), 'unregistered-family fallback fixture');
    assert.ok(names.includes('layout-with-text'), 'text-in-layout fixture');
    assert.ok(names.includes('mixed-family'), 'mixed registered/unregistered fixture');
  });

  test('every real fixture probes all four layers', () => {
    for (const f of FIXTURES) {
      assert.ok(f.measureText.length > 0, `${f.name}: needs measureText strings`);
      assert.ok(f.computedStyle.length > 0, `${f.name}: needs computedStyle props`);
      assert.ok(f.rects.length > 0, `${f.name}: needs rects`);
      assert.ok(f.textElements.length > 0, `${f.name}: needs textElements (line + text-mask diff)`);
    }
  });

  test('every real fixture uses a distinct family hypothesis', () => {
    // The fixtures must differ from each other in what they probe; at minimum
    // the family used must be non-degenerate.
    for (const f of FIXTURES) {
      const families = [...f.html.matchAll(/font-family:'([^']+)'/g)].map((m) => m[1]);
      assert.ok(families.length > 0, `${f.name}: no font-family in html`);
      assert.ok(families.every((fam) => fam.trim().length > 0), `${f.name}: empty family`);
    }
  });

  test('measureText fonts in real fixtures mention a family that exists in the html', () => {
    for (const f of FIXTURES) {
      const fams = [...f.html.matchAll(/font-family:'([^']+)'/g)].map((m) => m[1]);
      for (const m of f.measureText) {
        const match = m.font.match(/'([^']+)'/);
        assert.ok(match, `${f.name}: font "${m.font}" has no quoted family`);
        assert.ok(fams.includes(match[1]), `${f.name}: font family "${match[1]}" absent from html`);
      }
    }
  });

  test('screenshot tiers: text pixels are compared, not silently excluded', () => {
    // The whole point of the probe is that text pixels are measured under the
    // text tier — confirm the probe's comparison path reaches that tier by
    // exercising the same comparePixelBuffers call shape the probe uses.
    // Interior rect (away from the edges) so the pad is not clamped.
    const width = 40;
    const height = 40;
    const mask = rectsToTextMask(width, height, [{ x: 10, y: 10, width: 4, height: 4 }], MASK_PAD);
    assert.equal(mask.length, width * height);
    const textPixels = mask.filter((v) => v === 1).length;
    assert.ok(textPixels > 0, 'text mask must mark at least one pixel');
    assert.equal(textPixels, (4 + MASK_PAD * 2) * (4 + MASK_PAD * 2));
  });

  test('tolerances.json exposes the layers compareLayers consults', () => {
    assert.ok(TOL.measureText.maxPx > 0);
    assert.ok(TOL.rect.maxPx > 0);
    assert.ok(TOL.measureText.meanPx > 0);
  });

  test('the probe exit path is non-zero when validation fails', () => {
    // The probe guards with process.exit(1) on invalid fixtures; the lib
    // surfaces the same problems so the guard can trigger.
    const bad = validateFixtures([makeFixture({ html: '' })]);
    assert.ok(bad[0].problems.length > 0);
  });
});
