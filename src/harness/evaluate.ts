import { comparePixelBuffers } from './deltaE.js';
import type { Box, Fixture, LayerName } from './fixtures.js';

export interface MeasureTextLayerResult {
  layer: 'measureText';
  pass: boolean;
  strings: number;
  meanDelta: number;
  maxDelta: number;
  thresholds: { meanPx: number; maxPx: number };
}

export interface ComputedStyleLayerResult {
  layer: 'computedStyle';
  pass: boolean;
  props: number;
  mismatches: number;
  thresholds: { mode: 'exact' };
}

export interface RectLayerResult {
  layer: 'rect';
  pass: boolean;
  boxes: number;
  dims: number;
  maxDelta: number;
  thresholds: { maxPx: number };
}

export interface ScreenshotLayerResult {
  layer: 'screenshot';
  pass: boolean;
  /** non-text pixels compared under the §10 band. */
  comparedPixels: number;
  maskedPixels: number;
  exceedingPixels: number;
  percentExceeding: number;
  worstDeltaE: number;
  meanDeltaE: number;
  /** per-fixture text-parity metric: text pixels compared under the text tier. */
  textRegion: {
    pixels: number;
    maskedPixels: number;
    maskSharePct: number;
    exceedingPixels: number;
    percentExceeding: number;
    worstDeltaE: number;
    meanDeltaE: number;
    pass: boolean;
  };
  thresholds: { deltaE: number; exceedPct: number; textDeltaE: number; textExceedPct: number };
}

export type LayerResult =
  | MeasureTextLayerResult
  | ComputedStyleLayerResult
  | RectLayerResult
  | ScreenshotLayerResult;

export interface FixtureResult {
  name: string;
  note?: string;
  layers: Record<LayerName, LayerResult>;
  expected: Record<LayerName, 'pass' | 'fail'>;
  checkPass: boolean;
}

export function evaluateMeasureText(fixture: Fixture): MeasureTextLayerResult {
  const tol = fixture.tolerances.layers.measureText;
  const strings = new Set([...Object.keys(fixture.candidate.measureText), ...Object.keys(fixture.reference.measureText)]);
  let meanSum = 0;
  let maxDelta = 0;
  for (const s of strings) {
    const c = fixture.candidate.measureText[s] ?? NaN;
    const r = fixture.reference.measureText[s] ?? NaN;
    const delta = Math.abs(c - r);
    meanSum += delta;
    if (delta > maxDelta) maxDelta = delta;
  }
  const meanDelta = strings.size > 0 ? meanSum / strings.size : 0;
  return {
    layer: 'measureText',
    pass: meanDelta <= tol.meanPx && maxDelta <= tol.maxPx,
    strings: strings.size,
    meanDelta,
    maxDelta,
    thresholds: { meanPx: tol.meanPx, maxPx: tol.maxPx },
  };
}

export function evaluateComputedStyle(fixture: Fixture): ComputedStyleLayerResult {
  const ids = new Set([
    ...Object.keys(fixture.candidate.computedStyle),
    ...Object.keys(fixture.reference.computedStyle),
  ]);
  let props = 0;
  let mismatches = 0;
  for (const id of ids) {
    const cand = fixture.candidate.computedStyle[id] ?? {};
    const ref = fixture.reference.computedStyle[id] ?? {};
    const keys = new Set([...Object.keys(cand), ...Object.keys(ref)]);
    for (const k of keys) {
      props++;
      if ((cand[k] ?? undefined) !== (ref[k] ?? undefined)) mismatches++;
    }
  }
  return {
    layer: 'computedStyle',
    pass: mismatches === 0,
    props,
    mismatches,
    thresholds: { mode: 'exact' },
  };
}

export function evaluateRect(fixture: Fixture): RectLayerResult {
  const tol = fixture.tolerances.layers.rect;
  const ids = new Set([...Object.keys(fixture.candidate.rect), ...Object.keys(fixture.reference.rect)]);
  const dims = ['x', 'y', 'width', 'height'] as const;
  let boxes = 0;
  let dimCount = 0;
  let maxDelta = 0;
  for (const id of ids) {
    boxes++;
    const cand = fixture.candidate.rect[id] ?? ({} as Partial<Box>);
    const ref = fixture.reference.rect[id] ?? ({} as Partial<Box>);
    for (const d of dims) {
      dimCount++;
      const delta = Math.abs((cand[d] ?? NaN) - (ref[d] ?? NaN));
      if (delta > maxDelta) maxDelta = delta;
    }
  }
  return {
    layer: 'rect',
    pass: maxDelta <= tol.maxPx,
    boxes,
    dims: dimCount,
    maxDelta,
    thresholds: { maxPx: tol.maxPx },
  };
}

export function evaluateScreenshot(fixture: Fixture): ScreenshotLayerResult {
  const tol = fixture.tolerances.layers.screenshot;
  const result = comparePixelBuffers({
    candidate: fixture.candidateRgba,
    reference: fixture.referenceRgba,
    width: fixture.width,
    height: fixture.height,
    mask: fixture.mask,
    textMask: fixture.textMask,
    tolerance: tol,
  });
  const text = result.textRegion;
  const maskSharePct = text.pixels + text.maskedPixels > 0 ? (text.maskedPixels / (text.pixels + text.maskedPixels)) * 100 : 0;
  return {
    layer: 'screenshot',
    pass: result.pass,
    comparedPixels: result.comparedPixels,
    maskedPixels: result.maskedPixels,
    exceedingPixels: result.exceedingPixels,
    percentExceeding: result.percentExceeding,
    worstDeltaE: result.worstDeltaE,
    meanDeltaE: result.meanDeltaE,
    textRegion: {
      pixels: text.pixels,
      maskedPixels: text.maskedPixels,
      maskSharePct,
      exceedingPixels: text.exceedingPixels,
      percentExceeding: text.percentExceeding,
      worstDeltaE: text.worstDeltaE,
      meanDeltaE: text.meanDeltaE,
      pass: text.pass,
    },
    thresholds: { deltaE: tol.deltaE, exceedPct: tol.exceedPct, textDeltaE: tol.text.deltaE, textExceedPct: tol.text.exceedPct },
  };
}

/** Evaluate all four layers and assert each against the fixture's declared expected result. */
export function evaluateFixture(fixture: Fixture): FixtureResult {
  const layers: Record<LayerName, LayerResult> = {
    measureText: evaluateMeasureText(fixture),
    computedStyle: evaluateComputedStyle(fixture),
    rect: evaluateRect(fixture),
    screenshot: evaluateScreenshot(fixture),
  };
  let checkPass = true;
  for (const name of Object.keys(layers) as LayerName[]) {
    const actual = layers[name].pass;
    const expected = fixture.expected[name] === 'pass';
    if (actual !== expected) checkPass = false;
  }
  return { name: fixture.name, note: fixture.note, layers, expected: fixture.expected, checkPass };
}
