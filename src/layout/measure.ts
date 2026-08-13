/**
 * Text measurement and line breaking over @napi-rs/canvas.
 *
 * Line breaking for the fixtures is plain CSS `white-space: normal` word
 * wrapping: text breaks at space opportunities, greedily filling each line up
 * to the available width. For the simple Latin fixtures this matches Chrome's
 * UAX#14-based breaking exactly (space is the break opportunity, no
 * hyphenation, no CJK).
 */

import { createCanvas, type CanvasRenderingContext2D } from '@napi-rs/canvas';

export interface FontConfig {
  /** CSS family name as Chrome/fontconfig resolves it (e.g. 'Noto Sans'). */
  family: string;
  /** Path to the TTF file to register so both the engine and Chrome use the same glyphs. */
  filePath: string;
}

let context: CanvasRenderingContext2D | null = null;

export function initMeasurement(config: FontConfig): void {
  // The font is registered globally by render.ts (GlobalFonts). Here we just
  // set up a measurement context.
  context = createCanvas(1, 1).getContext('2d');
  context.font = `14px '${config.family}'`;
}

export function measureTextWidth(text: string, fontSize: number, family: string): number {
  const ctx = context ?? createCanvas(1, 1).getContext('2d');
  ctx.font = `${fontSize}px '${family}'`;
  return ctx.measureText(text).width;
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
): { count: number; width: number } {
  if (words.length === 0) return { count: 0, width: 0 };
  let cur = words[0];
  let width = measureTextWidth(cur, fontSize, family);
  let i = 1;
  for (; i < words.length; i++) {
    const trial = cur + ' ' + words[i];
    const w = measureTextWidth(trial, fontSize, family);
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
  /** returns the usable width for a line spanning [top, bottom). */
  available: (top: number, bottom: number) => { x: number; width: number };
}): { lines: LineBox[]; height: number } {
  const { text, y, lineHeight, fontSize, family, available } = opts;
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
    const res = wrapWords(words.slice(idx), fontSize, family, availWidth);
    const n = res.count;
    if (n === 0) {
      // A single word wider than the line: place it alone (overflow allowed).
      const w = words[idx];
      lines.push({ x: av.x, y: lineTop, width: measureTextWidth(w, fontSize, family), height: lineHeight, text: w, startWord: idx, endWord: idx + 1 });
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
