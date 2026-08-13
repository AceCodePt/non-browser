/**
 * Vertical metrics parsed from a TTF font file (hhea ascender/descender and
 * post underline metrics), used for text-decoration geometry. Blink derives its
 * underline/strikethrough/overline positions from the font's own vertical
 * metrics (see SimpleFontData::PlatformInit), so the paint module needs the
 * same numbers the oracle browser uses. Results are cached per file path.
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export interface FontVerticalMetrics {
  unitsPerEm: number;
  /** hhea ascender, in font units (positive, below baseline = +y). */
  ascent: number;
  /** hhea descender, in font units (positive magnitude, above baseline = -y). */
  descent: number;
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
    const post = tableOffset(buf, 'post');
    if (head !== null && hhea !== null && post !== null) {
      metrics = {
        unitsPerEm: Math.max(u16(buf, head + 18), 1),
        ascent: s16(buf, hhea + 4),
        descent: Math.abs(s16(buf, hhea + 6)),
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
