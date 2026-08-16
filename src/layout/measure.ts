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
import type { Color, TextAlign, WhiteSpaceValue } from './css.js';

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
 *
 * `align` applies text alignment per line within the available width:
 * center/right shift the line; justify stretches inter-word spaces so every
 * non-last line fills the available width, emitting one LineBox per word with
 * the stretched advance (the last line stays left-aligned, matching Chrome).
 *
 * `whiteSpace` selects how the breaker processes the text, matching Chrome's
 * line boxes for each value:
 *   - normal    collapse runs/leading/trailing white space, wrap at spaces
 *   - nowrap    collapse as normal, but never wrap (one line, overflowing)
 *   - pre       preserve spaces and newlines (newlines are forced breaks),
 *               no wrapping
 *   - pre-wrap  preserve spaces and newlines, wrap at spaces (a trailing space
 *               at a soft wrap stays on the line, matching Chrome's hung box)
 *   - pre-line  collapse spaces as normal but preserve newlines (forced breaks)
 * Every mode splits on `\n` first when newlines are significant; a trailing
 * newline's empty final segment does not generate a line box (Chrome drops
 * it), while empty interior segments do (empty line boxes).
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
  /** the element's used white-space (default normal). */
  whiteSpace?: WhiteSpaceValue;
  /** returns the usable width for a line spanning [top, bottom). */
  available: (top: number, bottom: number) => { x: number; width: number };
}): { lines: LineBox[]; height: number } {
  const { text, y, lineHeight, fontSize, family, available } = opts;
  const letterSpacing = opts.letterSpacing ?? 0;
  const align = opts.align ?? 'left';
  const ws = opts.whiteSpace ?? 'normal';
  const lines: LineBox[] = [];
  let lineTop = y;
  const measure = (s: string): number => measureTextWidth(s, fontSize, family, letterSpacing);
  const pushLine = (av: { x: number; width: number }, width: number, lineText: string): void => {
    let lineX = av.x;
    // An overflowing line stays at the start edge under every alignment.
    if (align === 'center' && width <= av.width) lineX = av.x + (av.width - width) / 2;
    else if (align === 'right' && width <= av.width) lineX = av.x + (av.width - width);
    lines.push({ x: lineX, y: lineTop, width, height: lineHeight, text: lineText, startWord: 0, endWord: 1 });
  };

  // --- pre: preserve every space; newlines are forced breaks; no wrapping ---
  if (ws === 'pre') {
    let segments = text.split('\n');
    if (segments[segments.length - 1] === '') segments.pop();
    for (const seg of segments) {
      const av = available(lineTop, lineTop + lineHeight);
      pushLine(av, measure(seg), seg);
      lineTop += lineHeight;
    }
    return { lines, height: lineTop - y };
  }

  // --- normal / nowrap: collapse the whole text (newlines become spaces) ---
  if (ws === 'normal' || ws === 'nowrap') {
    const collapsed = text.replace(/[ \t\r\n\f]+/g, ' ').trim();
    if (collapsed === '') return { lines, height: 0 };
    if (ws === 'nowrap') {
      const av = available(lineTop, lineTop + lineHeight);
      pushLine(av, measure(collapsed), collapsed);
      lineTop += lineHeight;
      return { lines, height: lineTop - y };
    }
    lineTop = fillWordLines(collapsed.split(' '), lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight);
    return { lines, height: lineTop - y };
  }

  // --- pre-line: collapse spaces but preserve newlines as forced breaks ---
  if (ws === 'pre-line') {
    let segments = text.split('\n');
    if (segments[segments.length - 1] === '') segments.pop();
    for (const seg of segments) {
      const collapsed = seg.replace(/[ \t\r\n\f]+/g, ' ').trim();
      if (collapsed === '') {
        const av = available(lineTop, lineTop + lineHeight);
        lines.push({ x: av.x, y: lineTop, width: 0, height: lineHeight, text: '', startWord: 0, endWord: 1 });
        lineTop += lineHeight;
        continue;
      }
      lineTop = fillWordLines(collapsed.split(' '), lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight);
    }
    return { lines, height: lineTop - y };
  }

  // --- pre-wrap: preserve spaces and newlines; wrap at spaces ---
  let segments = text.split('\n');
  if (segments[segments.length - 1] === '') segments.pop();
  for (const seg of segments) {
    if (seg === '') {
      const av = available(lineTop, lineTop + lineHeight);
      lines.push({ x: av.x, y: lineTop, width: 0, height: lineHeight, text: '', startWord: 0, endWord: 1 });
      lineTop += lineHeight;
      continue;
    }
    // Tokenize into words and preserved space runs.
    const tokens: { k: 'w' | 's'; text: string }[] = [];
    for (const m of seg.matchAll(/([^ ]+)|( +)/g)) {
      tokens.push(m[1] !== undefined ? { k: 'w', text: m[1] } : { k: 's', text: m[2] });
    }
    let i = 0;
    while (i < tokens.length) {
      const av = available(lineTop, lineTop + lineHeight);
      const availWidth = Math.max(0, av.width);
      let lineText = '';
      let hasWord = false;
      let breakAt = -1;
      let j = i;
      for (; j < tokens.length; j++) {
        const t = tokens[j];
        if (t.k === 's') {
          // A space run is a wrap opportunity: if the following word cannot
          // join, break here, keeping one hung space on the line (Chrome).
          if (hasWord && j + 1 < tokens.length && tokens[j + 1].k === 'w') {
            if (measure(lineText + t.text + tokens[j + 1].text) > availWidth) {
              breakAt = j;
              break;
            }
          }
          lineText += t.text;
        } else {
          if (hasWord && measure(lineText + t.text) > availWidth) {
            breakAt = j;
            break;
          }
          lineText += t.text;
          hasWord = true;
        }
      }
      if (breakAt === -1) {
        pushLine(av, measure(lineText), lineText);
        lineTop += lineHeight;
        i = tokens.length;
        continue;
      }
      // Break at a space token: the run collapses to one hung space (the rest
      // of the run is dropped, matching Chrome's union line box).
      pushLine(av, measure(lineText + ' '), lineText + ' ');
      lineTop += lineHeight;
      i = breakAt + 1;
    }
  }
  return { lines, height: lineTop - y };
}

/**
 * Greedy word wrap over a collapsed word list, emitting one line per pass and
 * returning the y after the last line. Shared by `normal` and `pre-line` (each
 * pre-line segment is a fresh word list, so its last line correctly stays
 * un-justified).
 */
function fillWordLines(
  words: string[],
  lines: LineBox[],
  startTop: number,
  available: (top: number, bottom: number) => { x: number; width: number },
  measure: (s: string) => number,
  align: TextAlign,
  fontSize: number,
  family: string,
  letterSpacing: number,
  lineHeight: number,
): number {
  let lineTop = startTop;
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
      lines.push({ x: av.x, y: lineTop, width: measure(w), height: lineHeight, text: w, startWord: idx, endWord: idx + 1 });
      idx += 1;
    } else {
      const lineWords = words.slice(idx, idx + n);
      const isLastLine = idx + n >= totalWords;
      if (align === 'justify' && !isLastLine && lineWords.length > 1 && res.width < availWidth) {
        // Distribute the surplus evenly across the inter-word spaces, emitting
        // one word-per-LineBox so painting draws each word at its stretched x.
        const stretch = (availWidth - res.width) / (lineWords.length - 1);
        const spaceW = measure(' ');
        let x = av.x;
        for (let wi = 0; wi < lineWords.length; wi++) {
          const w = lineWords[wi];
          lines.push({ x, y: lineTop, width: measure(w), height: lineHeight, text: w, startWord: idx + wi, endWord: idx + wi + 1 });
          if (wi < lineWords.length - 1) x += measure(w) + spaceW + stretch;
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
  return lineTop;
}
