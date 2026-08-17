/**
 * Text measurement and line breaking over the generic Canvas interface.
 *
 * Measurement is the interface's `measureText` (skia today, CoreText/HarfBuzz
 * later). Line breaking for the wrapping modes (`normal`/`pre-line`/`pre-wrap`)
 * is owned by @chenglou/pretext over the same interface: `layoutTextLines`
 * feeds the text through `breakNextLine` (src/pretext/index.ts) and keeps only
 * the Chrome-parity layers that the plain-text breaker cannot express —
 * float-intrusion via the `available` callback, per-word stretched advances
 * for `text-align: justify`, and the per-mode white-space handling. The greedy
 * word wrapper (`wrapWords`/`fillWordLines`) remains as the flagged fallback
 * (see the breaker knob and docs/ledgers/breakers.md); the drift gate asserts
 * it cannot silently diverge from Pretext on the spine corpus.
 */

import type { CanvasFactory, CanvasLike } from '../canvas/interface.js';
import { skiaCanvasFactory } from '../canvas/skia.js';
import { getActiveBrowserConfig, resolveFontFamily } from '../config/browser-config.js';
import { breakNextLine, prepareText, type PrepareOptions } from '../pretext/index.js';
import type { Color, TextAlign, WhiteSpaceValue } from './css.js';
import { letterSpacingPositions } from './letter-spacing.js';

export interface FontConfig {
  /** CSS family name as Chrome/fontconfig resolves it (e.g. 'Noto Sans'). */
  family: string;
  /** Path to the TTF file to register so both the engine and Chrome use the same glyphs. */
  filePath: string;
}

let factory: CanvasFactory = skiaCanvasFactory;
let measurementCanvas: CanvasLike | null = null;

/**
 * Which breaker owns the soft-wrap (break/word-fill) decision:
 *   - `true`  (default): @chenglou/pretext prepare/layout over the Canvas
 *     interface's measureText — the shipped text-layout engine per charter §3.
 *   - `false`: the hand-rolled greedy word wrapper (the flagged fallback). It
 *     exists so operators can opt out of Pretext-specific divergences (see
 *     docs/ledgers/breakers.md) and as the reference the drift gate compares
 *     the Pretext path against on the spine corpus.
 */
let usePretextBreaker = true;

export function setUsePretextBreaker(enabled: boolean): void {
  usePretextBreaker = enabled;
}

export function getUsePretextBreaker(): boolean {
  return usePretextBreaker;
}

/**
 * Breaker selection knob for the verify scripts: `CASCADE_BREAKER=greedy` runs
 * the flagged fallback instead of Pretext (used by the drift gate and the
 * before/after bench). No-op when unset or set to `pretext`.
 */
export function applyBreakerFromEnv(): void {
  if (process.env.CASCADE_BREAKER === 'greedy') usePretextBreaker = false;
  else usePretextBreaker = true;
}

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
  // letter-spacing grows the used width by ls per position Blink actually
  // spaces (every codepoint for Latin/CJK, suppressed inside cursive runs).
  return m.width + letterSpacing * letterSpacingPositions(text);
}

export interface LineBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  startWord: number;
  endWord: number;
  baseline?: number;
  fontSize?: number;
  family?: string;
  color?: Color;
  letterSpacing?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  decorationLines?: import('./block-inline.js').TextDecorationPaint | null;
}

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
 *
 * For the wrapping modes, the break/word-fill decision is Pretext's when
 * `usePretextBreaker` is set (the default); the greedy wrapper below is the
 * `CASCADE_BREAKER=greedy` fallback. Both paths feed the same per-mode
 * white-space handling and alignment layers, so the two cannot disagree on
 * the layering — only on where a line breaks (see docs/ledgers/breakers.md).
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
  align?: TextAlign;
  whiteSpace?: WhiteSpaceValue;
  rtl?: boolean;
  available: (top: number, bottom: number) => { x: number; width: number };
}): { lines: LineBox[]; height: number } {
  const { text, y, lineHeight, fontSize, family, available } = opts;
  const letterSpacing = opts.letterSpacing ?? 0;
  const align = opts.align ?? 'left';
  const ws = opts.whiteSpace ?? 'normal';
  const rtl = opts.rtl ?? false;
  const lines: LineBox[] = [];
  let lineTop = y;
  const measure = (s: string): number => measureTextWidth(s, fontSize, family, letterSpacing);
  const pushLine = (av: { x: number; width: number }, width: number, lineText: string): void => {
    // The line's start edge is the inline-start (right under RTL); an
    // overflowing line stays there under every alignment, matching Chrome.
    const fits = width <= av.width;
    let lineX = av.x;
    if (align === 'center') {
      lineX = rtl && !fits ? av.x + (av.width - width) : av.x + (fits ? (av.width - width) / 2 : 0);
    } else if (align === 'right') {
      lineX = rtl ? av.x + (av.width - width) : fits ? av.x + (av.width - width) : av.x;
    } else if (align === 'left') {
      lineX = rtl && !fits ? av.x + (av.width - width) : av.x;
    }
    lines.push({ x: lineX, y: lineTop, width, height: lineHeight, text: lineText, startWord: 0, endWord: 1 });
  };

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

  if (ws === 'normal' || ws === 'nowrap') {
    const collapsed = text.replace(/[ \t\r\n\f]+/g, ' ').trim();
    if (collapsed === '') return { lines, height: 0 };
    if (ws === 'nowrap') {
      const av = available(lineTop, lineTop + lineHeight);
      pushLine(av, measure(collapsed), collapsed);
      lineTop += lineHeight;
      return { lines, height: lineTop - y };
    }
    if (usePretextBreaker) {
      lineTop = pretextWordFill(collapsed, lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight, 'normal', false, rtl);
    } else {
      lineTop = fillWordLines(collapsed.split(' '), lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight, rtl);
    }
    return { lines, height: lineTop - y };
  }

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
      if (usePretextBreaker) {
        lineTop = pretextWordFill(collapsed, lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight, 'normal', false, rtl);
      } else {
        lineTop = fillWordLines(collapsed.split(' '), lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight, rtl);
      }
    }
    return { lines, height: lineTop - y };
  }

  if (usePretextBreaker) {
    lineTop = pretextWordFill(text, lines, lineTop, available, measure, align, fontSize, family, letterSpacing, lineHeight, 'pre-wrap', true);
    return { lines, height: lineTop - y };
  }

  let segments = text.split('\n');
  if (segments[segments.length - 1] === '') segments.pop();
  for (const seg of segments) {
    if (seg === '') {
      const av = available(lineTop, lineTop + lineHeight);
      lines.push({ x: av.x, y: lineTop, width: 0, height: lineHeight, text: '', startWord: 0, endWord: 1 });
      lineTop += lineHeight;
      continue;
    }
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
 * Pretext word-fill for the wrapping modes. Each line's break comes from
 * `breakNextLine` over the same Canvas-interface measurement the engine uses;
 * only the alignment/justify/float-intrusion layering is applied here.
 *
 * `prepareWs` is the Pretext white-space mode ('normal' collapses, 'pre-wrap'
 * preserves spaces and newlines) and `hungSpace` selects the pre-wrap union
 * line box: a trailing preserved-space run collapses to one hung space that
 * stays on the line (Chrome). Under 'normal' the trailing space is dropped
 * instead — it collapses away at the wrap point and is not painted.
 */
function pretextWordFill(
  text: string,
  lines: LineBox[],
  startTop: number,
  available: (top: number, bottom: number) => { x: number; width: number },
  measure: (s: string) => number,
  align: TextAlign,
  fontSize: number,
  family: string,
  letterSpacing: number,
  lineHeight: number,
  prepareWs: 'normal' | 'pre-wrap',
  hungSpace: boolean,
  rtl = false,
): number {
  let lineTop = startTop;
  const prepared = prepareText(text, cssFontString(fontSize, family), { whiteSpace: prepareWs, letterSpacing });
  const totalSegments = prepared.segments.length;
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };
  while (true) {
    const av = available(lineTop, lineTop + lineHeight);
    const availWidth = Math.max(0, av.width);
    const broke = breakNextLine(prepared, cursor, availWidth);
    if (broke === null) break;
    if (broke.end.segmentIndex === cursor.segmentIndex && broke.end.graphemeIndex === cursor.graphemeIndex) break;
    let lineText = broke.text;
    if (hungSpace) lineText = lineText.replace(/ +$/, (m) => (m ? ' ' : m));
    else lineText = lineText.replace(/[ \t]+$/, '');
    const width = measure(lineText);
    const words = lineText.split(' ');
    if (align === 'justify' && !hungSpace && !(broke.end.segmentIndex >= totalSegments) && words.length > 1 && width < availWidth) {
      // Distribute the surplus evenly across the inter-word spaces, emitting
      // one word-per-LineBox so painting draws each word at its stretched x.
      // The first word sits at the inline-start edge (right under RTL).
      const stretch = (availWidth - width) / (words.length - 1);
      const spaceW = measure(' ');
      const dir = rtl ? -1 : 1;
      let x = rtl ? av.x + availWidth : av.x;
      for (let wi = 0; wi < words.length; wi++) {
        const wx = dir === 1 ? x : x - measure(words[wi]);
        lines.push({ x: wx, y: lineTop, width: measure(words[wi]), height: lineHeight, text: words[wi], startWord: 0, endWord: 1 });
        x += dir * (measure(words[wi]) + spaceW + stretch);
      }
    } else {
      // An overflowing line stays at the inline-start edge under every
      // alignment (the right edge under RTL), matching Chrome.
      const fits = width <= availWidth;
      let lineX = av.x;
      if (align === 'center') lineX = rtl && !fits ? av.x + (availWidth - width) : fits ? av.x + (availWidth - width) / 2 : av.x;
      else if (align === 'right') lineX = rtl ? av.x + (availWidth - width) : fits ? av.x + (availWidth - width) : av.x;
      else if (align === 'left') lineX = rtl && !fits ? av.x + (availWidth - width) : av.x;
      lines.push({ x: lineX, y: lineTop, width, height: lineHeight, text: lineText, startWord: 0, endWord: 1 });
    }
    lineTop += lineHeight;
    cursor = broke.end;
  }
  return lineTop;
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
  rtl = false,
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
      const w = words[idx];
      lines.push({ x: av.x, y: lineTop, width: measure(w), height: lineHeight, text: w, startWord: idx, endWord: idx + 1 });
      idx += 1;
    } else {
      const lineWords = words.slice(idx, idx + n);
      const isLastLine = idx + n >= totalWords;
      if (align === 'justify' && !isLastLine && lineWords.length > 1 && res.width < availWidth) {
        // Distribute the surplus evenly across the inter-word spaces, emitting
        // one word-per-LineBox so painting draws each word at its stretched x.
        // The first word sits at the inline-start edge (right under RTL).
        const stretch = (availWidth - res.width) / (lineWords.length - 1);
        const spaceW = measure(' ');
        const dir = rtl ? -1 : 1;
        let x = rtl ? av.x + availWidth : av.x;
        for (let wi = 0; wi < lineWords.length; wi++) {
          const w = lineWords[wi];
          const wx = dir === 1 ? x : x - measure(w);
          lines.push({ x: wx, y: lineTop, width: measure(w), height: lineHeight, text: w, startWord: idx + wi, endWord: idx + wi + 1 });
          x += dir * (measure(w) + spaceW + stretch);
        }
      } else {
        const lineText = lineWords.join(' ');
        // An overflowing line stays at the inline-start edge under every
        // alignment (the right edge under RTL).
        const fits = res.width <= availWidth;
        let lineX = av.x;
        if (align === 'center') lineX = rtl && !fits ? av.x + (av.width - res.width) : fits ? av.x + (availWidth - res.width) / 2 : av.x;
        else if (align === 'right') lineX = rtl ? av.x + (availWidth - res.width) : fits ? av.x + (availWidth - res.width) : av.x;
        else if (align === 'left') lineX = rtl && !fits ? av.x + (availWidth - res.width) : av.x;
        lines.push({ x: lineX, y: lineTop, width: res.width, height: lineHeight, text: lineText, startWord: idx, endWord: idx + n });
      }
      idx += n;
    }
    lineTop += lineHeight;
  }
  return lineTop;
}
