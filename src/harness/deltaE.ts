import type { ScreenshotTolerance, TextTolerance } from './tolerances.js';

export interface TextRegionResult {
  pixels: number;
  maskedPixels: number;
  exceedingPixels: number;
  percentExceeding: number;
  worstDeltaE: number;
  meanDeltaE: number;
  pass: boolean;
}

export interface PixelCompareResult {
  width: number;
  height: number;
  /** non-text pixels compared under the §10 band. */
  comparedPixels: number;
  maskedPixels: number;
  exceedingPixels: number;
  percentExceeding: number;
  worstDeltaE: number;
  meanDeltaE: number;
  textRegion: TextRegionResult;
  pass: boolean;
}

// CIE76 (ΔE*ab) in Lab space, D65 reference white. Used for the paint layer's
// per-pixel color distance per the charter ("delta-E <= 2").
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

function srgbToLinear(v: number): number {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.072175 * bl;
  const z = 0.0193339 * rl + 0.119192 * gl + 0.9503041 * bl;
  const fx = x / XN;
  const fy = y / YN;
  const fz = z / ZN;
  const ft = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const L = 116 * ft(fy) - 16;
  const a = 500 * (ft(fx) - ft(fy));
  const bb = 200 * (ft(fy) - ft(fz));
  return [L, a, bb];
}

export function deltaE76(
  l1: number,
  a1: number,
  b1: number,
  l2: number,
  a2: number,
  b2: number,
): number {
  const dl = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dl * dl + da * da + db * db);
}

export interface CompareInputs {
  candidate: Buffer;
  reference: Buffer;
  width: number;
  height: number;
  mask?: Uint8Array | null;
  textMask?: Uint8Array | null;
  tolerance: ScreenshotTolerance;
  /** Text-region tier; required (in practice) when textMask is present. */
  textTolerance?: TextTolerance | null;
}

/**
 * Compare a candidate buffer against a reference buffer per pixel.
 * Non-text pixels pass when at most `tolerance.exceedPct` exceed `tolerance.deltaE`
 * (the charter §10 band). Pixels inside `textMask` are compared under the
 * documented `textTolerance` tier instead (same per-pixel deltaE, raised
 * exceed allowance for the Skia rasterizer gap). Masked pixels are excluded
 * from both the count and the denominator of whichever region they belong to.
 */
export function comparePixelBuffers(inputs: CompareInputs): PixelCompareResult {
  const { candidate, reference, width, height, mask, textMask, tolerance } = inputs;
  const textTolerance = inputs.textTolerance ?? tolerance.text;
  if (candidate.length !== width * height * 4 || reference.length !== width * height * 4) {
    throw new Error('pixel buffer size mismatch');
  }
  if (mask !== null && mask !== undefined && mask.length !== width * height) {
    throw new Error('mask size mismatch');
  }
  if (textMask !== null && textMask !== undefined && textMask.length !== width * height) {
    throw new Error('textMask size mismatch');
  }

  const refLab = new Float64Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const lab = srgbToLab(reference[o], reference[o + 1], reference[o + 2]);
    refLab[i * 3] = lab[0];
    refLab[i * 3 + 1] = lab[1];
    refLab[i * 3 + 2] = lab[2];
  }

  let compared = 0;
  let maskedCount = 0;
  let exceeding = 0;
  let sum = 0;
  let worst = 0;
  let textSum = 0;
  const text: TextRegionResult = {
    pixels: 0,
    maskedPixels: 0,
    exceedingPixels: 0,
    percentExceeding: 0,
    worstDeltaE: 0,
    meanDeltaE: 0,
    pass: true,
  };
  for (let i = 0; i < width * height; i++) {
    const isText = textMask !== null && textMask !== undefined && textMask[i] === 1;
    if (mask !== null && mask !== undefined && mask[i] === 1) {
      maskedCount++;
      if (isText) text.maskedPixels++;
      continue;
    }
    const o = i * 4;
    const lab = srgbToLab(candidate[o], candidate[o + 1], candidate[o + 2]);
    const d = deltaE76(lab[0], lab[1], lab[2], refLab[i * 3], refLab[i * 3 + 1], refLab[i * 3 + 2]);
    if (isText) {
      text.pixels++;
      textSum += d;
      if (d > text.worstDeltaE) text.worstDeltaE = d;
      if (d > textTolerance.deltaE) text.exceedingPixels++;
      continue;
    }
    compared++;
    sum += d;
    if (d > worst) worst = d;
    if (d > tolerance.deltaE) exceeding++;
  }
  text.meanDeltaE = text.pixels > 0 ? textSum / text.pixels : 0;
  text.percentExceeding = text.pixels > 0 ? (text.exceedingPixels / text.pixels) * 100 : 0;
  text.pass = text.pixels === 0 || text.percentExceeding <= textTolerance.exceedPct;

  const percentExceeding = compared > 0 ? (exceeding / compared) * 100 : 0;
  const meanDeltaE = compared > 0 ? sum / compared : 0;
  return {
    width,
    height,
    comparedPixels: compared,
    maskedPixels: maskedCount,
    exceedingPixels: exceeding,
    percentExceeding,
    worstDeltaE: worst,
    meanDeltaE,
    textRegion: text,
    pass: percentExceeding <= tolerance.exceedPct && text.pass,
  };
}
