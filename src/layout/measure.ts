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
import type { Color, TextAlign } from './css.js';

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

export function measureTextWidth(text: string, fontSize: number, family: string, letterSpacing = 0): number {
  const resolved = resolveFontFamily(getActiveBrowserConfig(), family);
  const m = getMeasurementCanvas().measureText(text, `${fontSize}px '${resolved}'`);
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
 *
 * `align` applies text alignment per line within the available width:
 * center/right shift the line; justify stretches inter-word spaces so every
 * non-last line fills the available width, emitting one LineBox per word with
 * the stretched advance (the last line stays left-aligned, matching Chrome).
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
  /** horizontal text alignment (default left). */
  align?: TextAlign;
  /** returns the usable width for a line spanning [top, bottom). */
  available: (top: number, bottom: number) => { x: number; width: number };
}): { lines: LineBox[]; height: number } {
  const { text, y, lineHeight, fontSize, family, available } = opts;
  const letterSpacing = opts.letterSpacing ?? 0;
  const align = opts.align ?? 'left';
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
      const lineWords = words.slice(idx, idx + n);
      const isLastLine = idx + n >= totalWords;
      if (align === 'justify' && !isLastLine && lineWords.length > 1 && res.width < availWidth) {
        // Distribute the surplus evenly across the inter-word spaces, emitting
        // one word-per-LineBox so painting draws each word at its stretched x.
        const stretch = (availWidth - res.width) / (lineWords.length - 1);
        const spaceW = measureTextWidth(' ', fontSize, family, letterSpacing);
        let x = av.x;
        for (let wi = 0; wi < lineWords.length; wi++) {
          const w = lineWords[wi];
          lines.push({ x, y: lineTop, width: measureTextWidth(w, fontSize, family, letterSpacing), height: lineHeight, text: w, startWord: idx + wi, endWord: idx + wi + 1 });
          if (wi < lineWords.length - 1) x += measureTextWidth(w, fontSize, family, letterSpacing) + spaceW + stretch;
        }
      } else {
        const lineText = lineWords.join(' ');
        let lineX = av.x;
        // An overflowing line stays at the start edge under every alignment.
        if (align === 'center' && res.width <= availWidth) lineX = av.x + (availWidth - res.width) / 2;
        else if (align === 'right' && res.width <= availWidth) lineX = av.x + (availWidth - res.width);
        lines.push({ x: lineX, y: lineTop, width: res.width, height: lineHeight, text: lineText, startWord: idx, endWord: idx + n });
      }
      idx += n;
    }
    lineTop += lineHeight;
  }
  return { lines, height: lineTop - y };
}
