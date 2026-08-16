/**
 * The `browser-config` the charter's target-browser contract (§4) defines: it
 * selects the font-registration set (which font files the engine registers
 * into the Canvas interface) and the per-browser fallback table (how an
 * unregistered CSS family resolves to a registered family), so the engine's
 * measure/paint reproduce the oracle browser's glyph resolution.
 *
 * The skia Canvas interface and the layout/paint pipeline are shared across
 * browsers; only this configuration differs.
 */

import { chromeConfig } from './chrome.js';

export type BrowserTarget = 'chrome' | 'firefox' | 'safari';

/** One font file the engine registers, under a CSS family name. */
export interface FontRegistration {
  /** CSS family name the file registers under (e.g. 'Source Code Pro'). */
  family: string;
  /** Path to the .ttf/.woff2/.otf file. */
  filePath: string;
}

export interface BrowserConfig {
  browser: BrowserTarget;
  /** Font files the engine registers for this browser. */
  fonts: FontRegistration[];
  /**
   * Fallback table: CSS family name -> the family the engine should actually
   * measure/paint with (a registered family or `defaultFamily`). Populated for
   * the families the browser resolves differently from the engine's own font
   * lookup, so both sides agree on glyphs.
   */
  fallback: Record<string, string>;
  /** Family used when a CSS family is neither registered nor in `fallback`. */
  defaultFamily: string;
  /** Font file backing `defaultFamily`. */
  defaultFile: string;
  /**
   * Per-script fallback preference: script group -> the family Chrome's
   * fontconfig resolves a run's missing glyphs to (e.g. `Hani` -> Droid Sans
   * Fallback). Layered on the fallback table: a run only switches to this face
   * when the active family genuinely lacks the run's script (see
   * `scriptCoverage`). An empty table disables run-splitting entirely, so
   * configs without per-script data keep measuring through the single-face
   * seam.
   */
  scriptFallback?: Record<string, string>;
  /**
   * Which script groups each registered family genuinely covers (glyph
   * coverage). A face change is justified only when the active family is NOT
   * listed for the run's script — coverage is carried as knowledge rather than
   * inferred from advances, because a covered glyph's advance can coincide
   * with the face's .notdef advance (e.g. Noto Sans's V at 0.6em).
   */
  scriptCoverage?: Record<string, string[]>;
}

/** Resolve a CSS font-family name deterministically (charter §4). */
export function resolveFontFamily(config: BrowserConfig, cssFamily: string): string {
  if (config.fonts.some((f) => f.family === cssFamily)) return cssFamily;
  const mapped = config.fallback[cssFamily];
  if (mapped) return mapped;
  return config.defaultFamily;
}

let activeConfig: BrowserConfig = chromeConfig;

/** The browser-config currently driving measurement/paint. */
export function getActiveBrowserConfig(): BrowserConfig {
  return activeConfig;
}

/** Select the browser-config for the current render. */
export function setActiveBrowserConfig(config: BrowserConfig): void {
  activeConfig = config;
}
