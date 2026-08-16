/**
 * Text measurement and line breaking over the generic Canvas interface.
 *
 * Measurement is the interface's `measureText` (skia today, CoreText/HarfBuzz
 * later); line breaking for the fixtures is plain CSS `white-space: normal`
 * word wrapping: text breaks at space opportunities, greedily filling each line
 * up to the available width. For the simple Latin fixtures this matches
 * Chrome's UAX#14-based breaking exactly (space is the break opportunity, no
 * hyphenation, no CJK). Pretext-based breaking over the same interface is wired
 * in src/pretext and owned by the text-breaker-parity task.
 */

import type { CanvasFactory, CanvasLike } from '../canvas/interface.js';
import { skiaCanvasFactory } from '../canvas/skia.js';
import { getActiveBrowserConfig, resolveFontFamily } from '../config/browser-config.js';
import type { Color } from './css.js';

export interface FontConfig {
  /** CSS family name as Chrome/fontconfig resolves it (e.g. 'Noto Sans'). */
  family: string;
  /** Path to the TTF file to register so both the engine and Chrome use the same glyphs. */
  filePath: string;
}

let factory: CanvasFactory = skiaCanvasFactory;
let measurementCanvas: CanvasLike | null = null;

/**
 * Set up the measurement canvas. Font registration is the factory's job
 * (render.ts registers via the factory before calling this). Returns the
 * measurement surface so callers can hand it to Pretext's shim.
 */
export function initMeasurement(config: FontConfig, f?: CanvasFactory): CanvasLike {
  factory = f ?? factory;
  measurementCanvas = factory.create(1, 1);
  measurementCanvas.measureText('', `14px '${config.family}'`);
  return measurementCanvas;
}

export function getMeasurementCanvas(): CanvasLike {
  if (measurementCanvas === null) measurementCanvas = factory.create(1, 1);
  return measurementCanvas;
}

/**
 * Build the CSS `font` shorthand string used by measurement and paint. The
 * weight/style prefix is omitted at the defaults (400/normal) so existing
 * callers keep producing `16px 'Noto Sans'` exactly.
 */
export function cssFontString(fontSize: number, family: string, fontWeight?: number, fontStyle?: 'normal' | 'italic'): string {
  const resolved = resolveFontFamily(getActiveBrowserConfig(), family);
  let prefix = '';
  if (fontStyle === 'italic') prefix += 'italic ';
  if (fontWeight !== undefined && fontWeight !== 400) {
    prefix += fontWeight === 700 ? 'bold ' : `${fontWeight} `;
  }
  return `${prefix}${fontSize}px '${resolved}'`;
}

export function measureTextWidth(text: string, fontSize: number, family: string, letterSpacing = 0, fontWeight?: number, fontStyle?: 'normal' | 'italic'): number {
  const m = getMeasurementCanvas().measureText(text, cssFontString(fontSize, family, fontWeight, fontStyle));
  // letter-spacing is added after every character (Blink applies it to the
  // trailing character too, so the used width grows by ls * length).
  return m.width + letterSpacing * text.length;
}

export interface LineBox {
  /** x of the line box content start (absolute). */
  x: number;
  /** y of the line box top (absolute). */
  y: number;
  /** used (painted) width of the line. */
  width: number;
  /** line box height (= line-height). */
  height: number;
  /** the text laid out on this line. */
  text: string;
  /** the word indices on this line. */
  startWord: number;
  endWord: number;
  /** absolute baseline y of the line (inline layout sets it; plain text layout leaves it unset). */
  baseline?: number;
  /**
   * Optional per-run style overrides (inline layout with styled inline boxes).
   * When absent, the caller's op-level text style applies.
   */
  fontSize?: number;
  family?: string;
  color?: Color;
  letterSpacing?: number;
  /** per-run font-weight override (e.g. bold runs inside a paragraph). */
  fontWeight?: number;
  /** per-run font-style override. */
  fontStyle?: 'normal' | 'italic';
  /** per-run text-decoration lines (e.g. an underline on an inline <a>). */
  decorationLines?: import('./block-inline.js').TextDecorationPaint | null;
}

/**
 * Greedy word wrap. `words` must already be split on whitespace; the caller
 * controls collapsing. `availableWidth` is the width usable on the current
 * line (already reduced by float intrusion).
 */
export function wrapWords(
  words: string[],
  fontSize: number,
  family: string,
  availableWidth: number,
  letterSpacing = 0,
): { count: number; width: number } {
  if (words.length === 0) return { count: 0, width: 0 };
  let cur = words[0];
  let width = measureTextWidth(cur, fontSize, family, letterSpacing);
  let i = 1;
  for (; i < words.length; i++) {
    const trial = cur + ' ' + words[i];
    const w = measureTextWidth(trial, fontSize, family, letterSpacing);
    if (w <= availableWidth) {
      cur = trial;
      width = w;
    } else {
      break;
    }
  }
  return { count: i, width };
}

/**
 * Layout `text` into line boxes starting at (x, y), each of height
 * `lineHeight`, honoring `available` as a function of the line's vertical
 * position (the float-intrusion-aware width). Returns the laid-out lines and
 * the resulting content height.
 */
export function layoutTextLines(opts: {
  text: string;
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  fontSize: number;
  family: string;
  letterSpacing?: number;
  /** returns the usable width for a line spanning [top, bottom). */
  available: (top: number, bottom: number) => { x: number; width: number };
}): { lines: LineBox[]; height: number } {
  const { text, y, lineHeight, fontSize, family, available } = opts;
  const letterSpacing = opts.letterSpacing ?? 0;
  // Collapse whitespace (CSS white-space: normal): collapse runs to a single
  // space, drop leading/trailing, split on spaces.
  const words = text.replace(/[ \t\r\n\f]+/g, ' ').trim().split(' ');
  const lines: LineBox[] = [];
  let lineTop = y;
  let idx = 0;
  const totalWords = words.length;
  while (idx < totalWords) {
    const av = available(lineTop, lineTop + lineHeight);
    const availWidth = Math.max(0, av.width);
    const res = wrapWords(words.slice(idx), fontSize, family, availWidth, letterSpacing);
    const n = res.count;
    if (n === 0) {
      // A single word wider than the line: place it alone (overflow allowed).
      const w = words[idx];
      lines.push({ x: av.x, y: lineTop, width: measureTextWidth(w, fontSize, family, letterSpacing), height: lineHeight, text: w, startWord: idx, endWord: idx + 1 });
      idx += 1;
    } else {
      const text = words.slice(idx, idx + n).join(' ');
      lines.push({ x: av.x, y: lineTop, width: res.width, height: lineHeight, text, startWord: idx, endWord: idx + n });
      idx += n;
    }
    lineTop += lineHeight;
  }
  return { lines, height: lineTop - y };
}
