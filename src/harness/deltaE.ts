import type { ScreenshotTolerance } from './tolerances.js';

export interface PixelCompareResult {
  width: number;
  height: number;
  comparedPixels: number;
  maskedPixels: number;
  exceedingPixels: number;
  percentExceeding: number;
  worstDeltaE: number;
  meanDeltaE: number;
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
  candidate: Buffer; // RGBA
  reference: Buffer; // RGBA
  width: number;
  height: number;
  mask?: Uint8Array | null; // 1 = excluded from the diff
  tolerance: ScreenshotTolerance;
}

/**
 * Compare a candidate buffer against a reference buffer per pixel.
 * A pixel "exceeds" when its delta-E is above tolerance.deltaE; the layer
 * passes when the fraction of exceeding pixels is at most tolerance.exceedPct.
 * Masked pixels are excluded from both the count and the denominator.
 */
export function comparePixelBuffers(inputs: CompareInputs): PixelCompareResult {
  const { candidate, reference, width, height, mask, tolerance } = inputs;
  if (candidate.length !== width * height * 4 || reference.length !== width * height * 4) {
    throw new Error('pixel buffer size mismatch');
  }
  if (mask !== null && mask !== undefined && mask.length !== width * height) {
    throw new Error('mask size mismatch');
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
  for (let i = 0; i < width * height; i++) {
    if (mask !== null && mask !== undefined && mask[i] === 1) {
      maskedCount++;
      continue;
    }
    compared++;
    const o = i * 4;
    const lab = srgbToLab(candidate[o], candidate[o + 1], candidate[o + 2]);
    const d = deltaE76(lab[0], lab[1], lab[2], refLab[i * 3], refLab[i * 3 + 1], refLab[i * 3 + 2]);
    sum += d;
    if (d > worst) worst = d;
    if (d > tolerance.deltaE) exceeding++;
  }

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
    pass: percentExceeding <= tolerance.exceedPct,
  };
}
