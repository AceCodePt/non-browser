/**
 * Chrome's canvas tab advance at the measurement seam.
 *
 * Blink's canvas `measureText` advances each U+0009 by the active face's space
 * advance (the plain-text painter shapes a tab as a space-sized gap), while
 * skia returns the font's raw U+0009 advance — which happens to agree only on
 * monospace faces, where the tab glyph advance equals the space advance
 * (corpus/measure-corpus/tabs/). On proportional faces the raw advance is
 * larger (Noto Sans shapes U+0009 at 0.6em against a 0.26em space), which was
 * the proportional-tab known gap. Non-tab segments keep the per-glyph
 * script-run fallback, so tabbed mixed-script strings still resolve per-run
 * faces.
 */

import type { BrowserConfig } from '../config/browser-config.js';
import { resolveFontFamily } from '../config/browser-config.js';
import { measureTextWithFallback, parseFontShorthand } from './script-fallback.js';

/**
 * Measure `text` with Chrome's canvas tab handling, or `null` when the text has
 * no tabs (the caller's plain single-face path stands).
 */
export function measureTextWithTabs(
  text: string,
  font: string,
  config: BrowserConfig,
  measure: (text: string, font: string) => number,
  hasFamily: (family: string) => boolean,
): number | null {
  if (!text.includes('\t')) return null;
  const parsed = parseFontShorthand(font);
  if (!parsed) return null;
  const { prefix, sizeToken } = parsed;

  const primary = hasFamily(parsed.family) ? parsed.family : resolveFontFamily(config, parsed.family);
  const active = hasFamily(primary) ? primary : undefined;
  if (!active) return null;

  const fontFor = (family: string): string => `${prefix}${sizeToken} '${family}'`;
  // A tab is whitespace, so Chrome always advances it in the primary face —
  // the same face the script-run shim assigns whitespace to.
  const tabAdvance = measure(' ', fontFor(active));

  const parts = text.split('\t');
  let width = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== '') {
      const seg = measureTextWithFallback(parts[i], font, config, measure, hasFamily);
      width += seg ?? measure(parts[i], font);
    }
    if (i < parts.length - 1) width += tabAdvance;
  }
  return width;
}
