import { readFileSync } from 'node:fs';

export interface MeasureTextTolerance {
  meanPx: number;
  maxPx: number;
}
export interface ComputedStyleTolerance {
  mode: 'exact';
}
export interface RectTolerance {
  maxPx: number;
}
export interface ScreenshotTolerance {
  deltaE: number;
  exceedPct: number;
}
export interface LayerTolerances {
  measureText: MeasureTextTolerance;
  computedStyle: ComputedStyleTolerance;
  rect: RectTolerance;
  screenshot: ScreenshotTolerance;
}
export interface Tolerances {
  version: number;
  layers: LayerTolerances;
}

/** Charter §2 values. Tolerance changes bump `version` and are recorded in docs/ledgers/tolerances.md. */
export const CHARTER_DEFAULTS: Tolerances = {
  version: 1,
  layers: {
    measureText: { meanPx: 0.01, maxPx: 0.5 },
    computedStyle: { mode: 'exact' },
    rect: { maxPx: 0.5 },
    screenshot: { deltaE: 2, exceedPct: 1 },
  },
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function numValue(obj: Record<string, unknown>, key: string, fallback: number): number {
  const v = obj[key];
  return isFiniteNumber(v) ? v : fallback;
}

/**
 * Load a tolerance JSON file and merge it over the charter defaults, so any
 * omitted layer keeps its charter value. Validates structure and numeric ranges.
 */
export function loadTolerances(path: string): Tolerances {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

  const layersRaw = (raw.layers ?? {}) as Record<string, Record<string, unknown>>;

  const measureTextRaw = (layersRaw.measureText ?? {}) as Record<string, unknown>;
  const computedStyleRaw = (layersRaw.computedStyle ?? {}) as Record<string, unknown>;
  const rectRaw = (layersRaw.rect ?? {}) as Record<string, unknown>;
  const screenshotRaw = (layersRaw.screenshot ?? {}) as Record<string, unknown>;

  const measureText: MeasureTextTolerance = {
    meanPx: numValue(measureTextRaw, 'meanPx', CHARTER_DEFAULTS.layers.measureText.meanPx),
    maxPx: numValue(measureTextRaw, 'maxPx', CHARTER_DEFAULTS.layers.measureText.maxPx),
  };
  const computedStyle: ComputedStyleTolerance = {
    mode: computedStyleRaw.mode === 'exact' ? 'exact' : 'exact',
  };
  const rect: RectTolerance = {
    maxPx: numValue(rectRaw, 'maxPx', CHARTER_DEFAULTS.layers.rect.maxPx),
  };
  const screenshot: ScreenshotTolerance = {
    deltaE: numValue(screenshotRaw, 'deltaE', CHARTER_DEFAULTS.layers.screenshot.deltaE),
    exceedPct: numValue(screenshotRaw, 'exceedPct', CHARTER_DEFAULTS.layers.screenshot.exceedPct),
  };

  if (!isFiniteNumber(measureText.meanPx) || measureText.meanPx < 0) {
    throw new Error('tolerances.layers.measureText.meanPx must be a non-negative number');
  }
  if (!isFiniteNumber(measureText.maxPx) || measureText.maxPx < 0) {
    throw new Error('tolerances.layers.measureText.maxPx must be a non-negative number');
  }
  if (!isFiniteNumber(rect.maxPx) || rect.maxPx < 0) {
    throw new Error('tolerances.layers.rect.maxPx must be a non-negative number');
  }
  if (!isFiniteNumber(screenshot.deltaE) || screenshot.deltaE < 0) {
    throw new Error('tolerances.layers.screenshot.deltaE must be a non-negative number');
  }
  if (!isFiniteNumber(screenshot.exceedPct) || screenshot.exceedPct < 0 || screenshot.exceedPct > 100) {
    throw new Error('tolerances.layers.screenshot.exceedPct must be between 0 and 100');
  }

  const version = typeof raw.version === 'number' && Number.isInteger(raw.version) ? raw.version : 1;

  return { version, layers: { measureText, computedStyle, rect, screenshot } };
}

/** Merge a per-fixture partial override over a base tolerance config. */
export function mergeTolerances(base: Tolerances, override: Partial<LayerTolerances>): Tolerances {
  return {
    version: base.version,
    layers: {
      measureText: { ...base.layers.measureText, ...(override.measureText ?? {}) },
      computedStyle: { mode: 'exact', ...(override.computedStyle ?? {}) },
      rect: { ...base.layers.rect, ...(override.rect ?? {}) },
      screenshot: { ...base.layers.screenshot, ...(override.screenshot ?? {}) },
    },
  };
}
