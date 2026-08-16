/**
 * Per-glyph script-run font fallback at the measurement seam.
 *
 * Chrome splits mixed-script strings into script runs and resolves each run
 * (and each glyph) through fontconfig, falling a glyph back to a per-script
 * face when the primary family lacks it. The engine's single-face seam
 * (`CanvasLike.measureText`) cannot reproduce that with one font string, so
 * this module shims the seam: it splits the text into grapheme clusters,
 * resolves each cluster's face through the active browser-config's per-script
 * fallback preference, and sums the per-segment advances. Segments stay
 * contiguous same-face runs so kerning and script joining are preserved.
 *
 * Coverage is carried as config knowledge (`scriptCoverage`), not inferred
 * from advance widths: a covered glyph's advance can equal the face's .notdef
 * advance (e.g. Noto Sans's "V" at 0.6em, Droid Sans Fallback's full-width
 * Han, tabs on monospace faces), so width-only glyph detection misreads real
 * glyphs as missing. Whitespace and control characters are always measured in
 * the primary face; Common/Inherited clusters take a fallback group from their
 * codepoint range (ASCII punctuation falls like Latin, CJK punctuation falls
 * like Han, Arabic-Indic digits fall like Arabic).
 */

import { resolveFontFamily } from '../config/browser-config.js';
import type { BrowserConfig } from '../config/browser-config.js';

/** Script groups a cluster's glyphs fall under for per-glyph fallback. */
export type ScriptGroup = 'Latn' | 'Hani' | 'Thai' | 'Arab' | 'Hebr' | 'Deva' | 'Emoji';

const EMOJI_HI = 0x1fa00; // 1F000..1FAFF: all emoji-presentation blocks
const MISC_SYMBOLS_LO = 0x2600;
const MISC_SYMBOLS_HI = 0x27bf; // misc symbols + dingbats (emoji-presentation subset)
const MISC_ARROWS_LO = 0x2b00;
const MISC_ARROWS_HI = 0x2bff;

function isEmoji(cp: number): boolean {
  if (cp >= 0x1f000 && cp < EMOJI_HI) return true;
  if (cp === 0xfe0f) return true; // variation selector-16 marks emoji presentation
  if (cp >= MISC_SYMBOLS_LO && cp <= MISC_SYMBOLS_HI) return true;
  return cp >= MISC_ARROWS_LO && cp <= MISC_ARROWS_HI;
}

function isWhitespaceOrControl(cp: number): boolean {
  return /[\s]/u.test(String.fromCodePoint(cp)) || /\p{Cc}/u.test(String.fromCodePoint(cp));
}

/** CJK-compatible Common codepoints (punctuation, fullwidth forms, radicals). */
function isCjkCommon(cp: number): boolean {
  return (
    (cp >= 0x2e80 && cp <= 0x2eff) || // CJK radicals supplement
    (cp >= 0x2f00 && cp <= 0x2fdf) || // Kangxi radicals
    (cp >= 0x3000 && cp <= 0x303f) || // CJK symbols and punctuation
    (cp >= 0x3190 && cp <= 0x319f) || // kanbun
    (cp >= 0x31c0 && cp <= 0x31ef) || // CJK strokes
    (cp >= 0x3200 && cp <= 0x32ff) || // enclosed CJK letters and months
    (cp >= 0x3300 && cp <= 0x33ff) || // CJK compatibility
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xffef) // fullwidth forms
  );
}

function isArabicCommon(cp: number): boolean {
  return (
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  );
}

function isHebrewCommon(cp: number): boolean {
  return cp >= 0x0590 && cp <= 0x05ff;
}

function isDevanagariCommon(cp: number): boolean {
  return cp >= 0x0900 && cp <= 0x097f;
}

function isThaiCommon(cp: number): boolean {
  return cp >= 0x0e00 && cp <= 0x0e7f;
}

/**
 * Classify a grapheme cluster into a script group for fallback purposes.
 * Strong scripts map through their Unicode script property; Common/Inherited
 * clusters (spaces, punctuation, combining marks) attach to a group from their
 * codepoint range. Whitespace and control characters return `null` — they are
 * always measured in the primary face, matching Chrome keeping spaces and tab
 * stops in the primary font.
 */
export function classifyCluster(cluster: string): ScriptGroup | null {
  const cp = cluster.codePointAt(0);
  if (cp === undefined) return null;
  if (isEmoji(cp)) return 'Emoji';
  const ch = String.fromCodePoint(cp);
  if (/\p{Script=Han}/u.test(ch)) return 'Hani';
  if (/\p{Script=Hiragana}/u.test(ch)) return 'Hani';
  if (/\p{Script=Katakana}/u.test(ch)) return 'Hani';
  if (/\p{Script=Hangul}/u.test(ch)) return 'Hani';
  if (/\p{Script=Thai}/u.test(ch)) return 'Thai';
  if (/\p{Script=Arabic}/u.test(ch)) return 'Arab';
  if (/\p{Script=Hebrew}/u.test(ch)) return 'Hebr';
  if (/\p{Script=Devanagari}/u.test(ch)) return 'Deva';
  if (/\p{Script=Latin}/u.test(ch)) return 'Latn';
  if (/\p{Script=Greek}/u.test(ch)) return 'Latn';
  if (/\p{Script=Cyrillic}/u.test(ch)) return 'Latn';
  if (isWhitespaceOrControl(cp)) return null;
  if (isCjkCommon(cp)) return 'Hani';
  if (isArabicCommon(cp)) return 'Arab';
  if (isHebrewCommon(cp)) return 'Hebr';
  if (isDevanagariCommon(cp)) return 'Deva';
  if (isThaiCommon(cp)) return 'Thai';
  return 'Latn';
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Split `text` into extended grapheme clusters (Intl.Segmenter, charter §6). */
export function graphemeClusters(text: string): string[] {
  const out: string[] = [];
  for (const s of segmenter.segment(text)) out.push(s.segment);
  return out;
}

/** Parse a CSS font shorthand into { prefix, sizeToken, family }. */
export function parseFontShorthand(font: string): { prefix: string; sizeToken: string; family: string } | null {
  const m = /([\d.]+)px/.exec(font);
  if (!m) return null;
  const prefix = font.slice(0, m.index);
  const sizeToken = m[0];
  const family = font
    .slice(m.index + sizeToken.length)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
  if (family === '') return null;
  return { prefix, sizeToken, family };
}

export interface FallbackRun {
  /** Contiguous same-face segment; kerning and script joining survive within it. */
  text: string;
  /** Full CSS font shorthand the segment measures and paints with. */
  font: string;
}

/**
 * Resolve `text` into Chrome's per-glyph script-run fallback segments, or
 * `null` when the whole string stays in the single primary face (so callers'
 * plain single-face path stands — run-splitting is a no-op whenever one
 * registered face covers the whole run).
 *
 * This is the one run-resolution authority: the measurement shim
 * (`measureTextWithFallback`) and the paint path (`SkiaCanvas.drawText`) both
 * resolve runs here, so a string's per-run faces and their accumulated advances
 * are identical at measure and paint time.
 *
 * `hasFamily` reports whether a family is measurable through the current
 * canvas.
 */
export function resolveFallbackRuns(
  text: string,
  font: string,
  config: BrowserConfig,
  hasFamily: (family: string) => boolean,
): FallbackRun[] | null {
  if (text === '') return null;
  const parsed = parseFontShorthand(font);
  if (!parsed) return null;
  const { prefix, sizeToken } = parsed;

  const primary = hasFamily(parsed.family) ? parsed.family : undefined;
  let active = primary;
  if (!active) {
    const resolved = resolveFontFamily(config, parsed.family);
    active = hasFamily(resolved) ? resolved : undefined;
  }
  if (!active) return null;

  const fontFor = (family: string): string => `${prefix}${sizeToken} '${family}'`;

  // Resolve the per-group fallback face; when the config names no face or the
  // face is not measurable through this canvas, keep the primary face.
  const groupFace = (group: ScriptGroup): string => {
    const named = config.scriptFallback?.[group];
    if (!named) return active;
    if (hasFamily(named)) return named;
    return active;
  };

  // A family without a coverage entry is assumed to cover its runs (a no-op),
  // so switching only ever happens for faces the config explicitly knows lack
  // a script group — a face change is justified by recorded coverage, never
  // inferred.
  const covered = (group: ScriptGroup): boolean =>
    config.scriptCoverage?.[active]?.includes(group) ?? true;

  // Assign each cluster a face; merge contiguous same-face clusters into
  // segments so kerning and script joining survive within a face.
  const segments: string[] = [];
  const segmentFonts: string[] = [];
  let cur = '';
  let curFont = '';
  for (const cluster of graphemeClusters(text)) {
    const group = classifyCluster(cluster);
    let face: string;
    if (group === null) {
      face = active;
    } else {
      const fallback = groupFace(group);
      face = fallback === active || covered(group) ? active : fallback;
    }
    const f = fontFor(face);
    if (curFont === '') {
      curFont = f;
      cur = cluster;
    } else if (f === curFont) {
      cur += cluster;
    } else {
      segments.push(cur);
      segmentFonts.push(curFont);
      cur = cluster;
      curFont = f;
    }
  }
  if (curFont !== '') {
    segments.push(cur);
    segmentFonts.push(curFont);
  }

  // Run-splitting is a no-op only when every cluster stayed in the primary
  // face (a single covered script run — the common Latin/CJK/RTL/Thai cases).
  // A single-cluster text whose face changed (e.g. one missing Han glyph on a
  // Latin primary, measured through Pretext's per-grapheme seam) must still
  // resolve to the fallback face's run.
  if (segmentFonts.every((f) => f === fontFor(active))) return null;

  return segments.map((s, i) => ({ text: s, font: segmentFonts[i] }));
}

/**
 * Measure `text` with Chrome's per-glyph script-run fallback, returning the
 * summed advance in px, or `null` when the whole string stays in the single
 * primary face (so the caller's plain single-face measurement stands).
 *
 * `measure` measures a text run against a CSS font shorthand; `hasFamily`
 * reports whether a family is measurable through the current canvas.
 */
export function measureTextWithFallback(
  text: string,
  font: string,
  config: BrowserConfig,
  measure: (text: string, font: string) => number,
  hasFamily: (family: string) => boolean,
): number | null {
  const runs = resolveFallbackRuns(text, font, config, hasFamily);
  if (runs === null) return null;
  let width = 0;
  for (const run of runs) width += measure(run.text, run.font);
  return width;
}
