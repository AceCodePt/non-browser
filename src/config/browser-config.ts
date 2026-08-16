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

export interface FontRegistration {
  family: string;
  filePath: string;
}

export interface BrowserConfig {
  browser: BrowserTarget;
  fonts: FontRegistration[];
  /**
   * Fallback table: CSS family name -> the family the engine should actually
   * measure/paint with (a registered family or `defaultFamily`). Populated for
   * the families the browser resolves differently from the engine's own font
   * lookup, so both sides agree on glyphs.
   */
  fallback: Record<string, string>;
  defaultFamily: string;
  defaultFile: string;
}

/** Resolve a CSS font-family name deterministically (charter §4). */
export function resolveFontFamily(config: BrowserConfig, cssFamily: string): string {
  if (config.fonts.some((f) => f.family === cssFamily)) return cssFamily;
  const mapped = config.fallback[cssFamily];
  if (mapped) return mapped;
  return config.defaultFamily;
}

let activeConfig: BrowserConfig = chromeConfig;

export function getActiveBrowserConfig(): BrowserConfig {
  return activeConfig;
}

export function setActiveBrowserConfig(config: BrowserConfig): void {
  activeConfig = config;
}
