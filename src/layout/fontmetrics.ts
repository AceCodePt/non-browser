/**
 * Vertical metrics parsed from a TTF font file (hhea ascender/descender and
 * post underline metrics), used for text-decoration geometry. Blink derives its
 * underline/strikethrough/overline positions from the font's own vertical
 * metrics (see SimpleFontData::PlatformInit), so the paint module needs the
 * same numbers the oracle browser uses. Results are cached per file path.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getActiveBrowserConfig, resolveFontFamily } from '../config/browser-config.js';

export interface FontVerticalMetrics {
  unitsPerEm: number;
  /** hhea ascender, in font units (positive, below baseline = +y). */
  ascent: number;
  /** hhea descender, in font units (positive magnitude, above baseline = -y). */
  descent: number;
  /** OS/2 sxHeight, in font units (used for `vertical-align: middle`). */
  sxHeight: number;
  /** post underlinePosition, in font units (positive = below baseline). */
  underlinePosition: number;
  /** post underlineThickness, in font units. */
  underlineThickness: number;
}

const cache = new Map<string, FontVerticalMetrics>();

/** Noto Sans fallback, matching /usr/share/fonts/google-noto/NotoSans-*.ttf. */
const FALLBACK: FontVerticalMetrics = {
  unitsPerEm: 1000,
  ascent: 1069,
  descent: 293,
  sxHeight: 536,
  underlinePosition: 100,
  underlineThickness: 50,
};

function u16(buf: Buffer, off: number): number {
  return buf.readUInt16BE(off);
}

function s16(buf: Buffer, off: number): number {
  return buf.readInt16BE(off);
}

/** Locate a table's offset in a TTF (or first font of a TTC). */
function tableOffset(buf: Buffer, tag: string): number | null {
  const sfnt = buf.readUInt32BE(0);
  let numTables: number;
  let recordOffset: number;
  if (sfnt === 0x00010000 || sfnt === 0x74727565) {
    numTables = u16(buf, 4);
    recordOffset = 12;
  } else if (sfnt === 0x74746366) {
    // TrueType collection: use the first font's table directory.
    const fontOffset = buf.readUInt32BE(12);
    numTables = u16(buf, fontOffset + 4);
    recordOffset = fontOffset + 12;
  } else {
    return null;
  }
  for (let i = 0; i < numTables; i++) {
    const rec = recordOffset + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === tag) return buf.readUInt32BE(rec + 8);
  }
  return null;
}

/**
 * Parse vertical metrics for a font file. Falls back to the Noto Sans metrics
 * when the file cannot be parsed (should not happen with registered fonts).
 */
export function fontVerticalMetrics(filePath: string): FontVerticalMetrics {
  const hit = cache.get(filePath);
  if (hit) return hit;
  let metrics = FALLBACK;
  try {
    const buf = readFileSync(filePath);
    const head = tableOffset(buf, 'head');
    const hhea = tableOffset(buf, 'hhea');
    const os2 = tableOffset(buf, 'OS/2');
    const post = tableOffset(buf, 'post');
    if (head !== null && hhea !== null && os2 !== null && post !== null) {
      metrics = {
        unitsPerEm: Math.max(u16(buf, head + 18), 1),
        ascent: s16(buf, hhea + 4),
        descent: Math.abs(s16(buf, hhea + 6)),
        sxHeight: Math.max(s16(buf, os2 + 86), 1),
        underlinePosition: -s16(buf, post + 8),
        underlineThickness: s16(buf, post + 10),
      };
    }
  } catch {
    // fall back to defaults
  }
  cache.set(filePath, metrics);
  return metrics;
}

export function fontMetricsKey(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex').slice(0, 12);
}

/**
 * Vertical metrics for a CSS family, resolved through the active browser
 * config's registrations (so `monospace` → the registered mono face gets the
 * same ascender/descender the oracle browser uses). Falls back to the active
 * default-font metrics when the family is not registered.
 */
export function fontMetricsForFamily(family: string): FontVerticalMetrics | null {
  const config = getActiveBrowserConfig();
  const resolved = resolveFontFamily(config, family);
  const reg = config.fonts.find((f) => f.family === resolved);
  if (reg) return fontVerticalMetrics(reg.filePath);
  return activeFontMetrics();
}

// ===== line-box vertical metrics =====
//
// Blink sizes each line box from the fonts' vertical metrics (hhea ascender /
// descender) scaled by font size and ROUNDED to whole pixels, then distributes
// half-leading (line-height − content height) around it. The strut (the
// anonymous inline box carrying the block's line-height) places the line's
// baseline at `ascent`, and glyph baselines / baseline-aligned inline-blocks
// align to it. Empirically verified against Chrome over font sizes 10–40 and
// line-heights 14–80 (probe-tmp*): ascent contribution =
// floor(roundedAscent + (lineHeight − roundedAscent − roundedDescent) / 2).
// These helpers let inline layout share the exact numbers Chrome produces.

let activeMetrics: FontVerticalMetrics | null = null;

/** Set the font metrics for the current render (render.ts does this once). */
export function setActiveFontMetrics(m: FontVerticalMetrics | null): void {
  activeMetrics = m;
}

export function activeFontMetrics(): FontVerticalMetrics | null {
  return activeMetrics;
}

/** Rounded font ascent/descent at a given font size (Chrome's FontMetrics ints). */
export function roundedAscent(metrics: FontVerticalMetrics, fontSize: number): number {
  return Math.round((metrics.ascent / metrics.unitsPerEm) * fontSize);
}

export function roundedDescent(metrics: FontVerticalMetrics, fontSize: number): number {
  return Math.round((metrics.descent / metrics.unitsPerEm) * fontSize);
}

/**
 * The baseline offset of a line box from its top for a run with the given
 * font-size/line-height — the strut ascent contribution. `metrics` may be null
 * (falls back to the legacy 0.75em heuristic) when the font file is unknown.
 */
export function lineAscentContribution(fontSize: number, lineHeight: number, metrics: FontVerticalMetrics | null): number {
  if (!metrics) return (lineHeight + fontSize * 0.75) / 2;
  const a = roundedAscent(metrics, fontSize);
  const d = roundedDescent(metrics, fontSize);
  return Math.floor(a + (lineHeight - a - d) / 2);
}

/** The strut's descent contribution (line box height − ascent). */
export function lineDescentContribution(fontSize: number, lineHeight: number, metrics: FontVerticalMetrics | null): number {
  return lineHeight - lineAscentContribution(fontSize, lineHeight, metrics);
}

/** Half the font's x-height (os/2 sxHeight), used by `vertical-align: middle`. */
export function halfXHeight(metrics: FontVerticalMetrics, fontSize: number): number {
  return (metrics.sxHeight / metrics.unitsPerEm) * fontSize / 2;
}
