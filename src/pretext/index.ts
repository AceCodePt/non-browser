/**
 * @chenglou/pretext integration over the generic Canvas interface.
 *
 * Pretext measures text through a lazily-created global OffscreenCanvas (its
 * `getMeasureContext()`). Node has no OffscreenCanvas, so this module installs
 * a minimal shim whose 2d context delegates `measureText` to the `CanvasLike`
 * interface — the exact seam the charter describes ("prepare/layout over the
 * Canvas interface's measureText"). Fonts are registered through the same
 * `CanvasFactory` that creates the measurement and paint surfaces, so the font
 * string handed to Pretext and the glyphs painted resolve to the same
 * registered typeface.
 *
 * The helpers below are thin wrappers over Pretext's prepare/layout; the
 * line-breaker parity work lives in the text-breaker-parity task and patches
 * behavior through these seams rather than forking Pretext source.
 */

import {
  layoutNextLineRange,
  layoutWithLines,
  materializeLineRange,
  prepareWithSegments,
  type LayoutLinesResult,
  type LayoutCursor,
  type LayoutLine,
  type LayoutLineRange,
  type PrepareOptions,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';
import type { CanvasLike } from '../canvas/interface.js';
import { getActiveBrowserConfig, resolveFontFamily } from '../config/browser-config.js';

export type { PrepareOptions };

/**
 * css-text-3 §6 knobs the engine layers on top of Pretext's PrepareOptions.
 * `cssWordBreak`/`overflowWrap` come from the computed word-break and
 * overflow-wrap/word-wrap declarations.
 */
export interface EngineBreakOptions {
  cssWordBreak?: 'normal' | 'break-all' | 'keep-all';
  overflowWrap?: 'normal' | 'break-word' | 'anywhere';
  /** css-text-3 §8: extra advance per space segment, applied to the prepared
   * widths so line breaking and line widths see it. */
  wordSpacing?: number;
}

/**
 * Resolve the CSS font-family inside a Pretext font shorthand through the
 * active browser-config, so the seam measures the exact family the engine's
 * measureTextWidth would. `prepareText`/`layoutLines` receive the fixture's
 * real computed family (e.g. `16px 'Courier New'`); the shorthand keeps its
 * size/weight/style prefix and only the family is replaced with the resolved
 * registered face — identical to `cssFontString` in src/layout/measure.ts, so
 * the seam and the engine share one font-resolution authority.
 */
export function resolveFontFamilyInShorthand(font: string): string {
  const sizeMatch = font.match(/[\d.]+px(?:\/(?:[\d.]+|normal))?(\s+[^;]+)$/);
  if (!sizeMatch) return font;
  const familyPart = sizeMatch[1].trim().replace(/^["']+|["']+$/g, '');
  if (familyPart === '') return font;
  const resolved = resolveFontFamily(getActiveBrowserConfig(), familyPart);
  return font.slice(0, font.length - sizeMatch[1].length) + ` '${resolved}'`;
}

/** The subset of a 2d measurement context Pretext actually consumes. */
export interface MeasureContextLike {
  font: string;
  measureText(text: string): { width: number };
}

/**
 * A 2d context adapter whose `measureText` goes through the Canvas interface.
 * Pretext only ever sets `.font` and calls `.measureText(...).width`, so this
 * is the whole surface it needs. Each measurement resolves the CSS family
 * through the active browser-config before hitting the Canvas (see
 * `resolveFontFamilyInShorthand`), keeping the seam on the same face the engine
 * measures with — the body of the browser-config seam parity work.
 */
class InterfaceMeasureContext implements MeasureContextLike {
  private currentFont = '14px sans-serif';

  constructor(private readonly canvas: CanvasLike) {}

  set font(value: string) {
    this.currentFont = value;
  }

  get font(): string {
    return this.currentFont;
  }

  measureText(text: string): { width: number } {
    return { width: this.canvas.measureText(text, resolveFontFamilyInShorthand(this.currentFont)).width };
  }
}

const shimSymbol = Symbol.for('nonbrowser.pretext.offscreen-canvas');

/**
 * `canvas` is the measurement surface created by the same CanvasFactory the
 * engine paints with. Idempotent per canvas.
 */
export function installPretextMeasurement(canvas: CanvasLike): void {
  const existing = (globalThis as Record<PropertyKey, unknown>)[shimSymbol];
  if (existing === canvas) return;

  class OffscreenCanvasShim {
    readonly width: number;
    readonly height: number;
    private readonly ctx: InterfaceMeasureContext;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.ctx = new InterfaceMeasureContext(canvas);
    }

    getContext(kind: string): InterfaceMeasureContext | null {
      return kind === '2d' ? this.ctx : null;
    }
  }

  (globalThis as Record<PropertyKey, unknown>).OffscreenCanvas = OffscreenCanvasShim;
  (globalThis as Record<PropertyKey, unknown>)[shimSymbol] = canvas;
}

/**
 * Segment text into extended grapheme clusters via `Intl.Segmenter` (charter
 * §6). This is the segmentation primitive Pretext consumes at grapheme
 * granularity; parity with the oracle browser's ICU is proven by
 * `npm run verify:segmenter` (corpus/segmenter-icu/, ledger docs/ledgers/icu.md).
 */
export function segmentGraphemes(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const out: string[] = [];
  for (const s of segmenter.segment(text)) out.push(s.segment);
  return out;
}

export function prepareText(
  text: string,
  font: string,
  options?: PrepareOptions & EngineBreakOptions,
): PreparedTextWithSegments {
  const prepared = prepareWithSegments(text, font, options);
  // css-text-3 §6: Pretext measures per-grapheme split advances for every
  // word-like run (overflow-wrap:break-word semantics). Under the default
  // overflow-wrap:normal — unless word-break:break-all opts in — those
  // in-word opportunities must not exist: a word that fits nowhere on the
  // line overflows instead of splitting (probe-verified against Chrome).
  // CJK units under word-break:normal are single graphemes here (unbreakable
  // anyway), and keep-all runs lose their overflow fallback, matching
  // Chrome's keep-all (the run overflows unless overflow-wrap re-allows).
  const overflowWrap = options?.overflowWrap ?? 'normal';
  const cssWordBreak = options?.cssWordBreak ?? 'normal';
  if (overflowWrap === 'normal' && cssWordBreak !== 'break-all') {
    const core = prepared as PreparedTextWithSegments & {
      kinds: string[];
      breakableFitAdvances: (number[] | null)[];
      breakablePreferredBreaks: (number[] | null)[];
    };
    for (let i = 0; i < core.breakableFitAdvances.length; i++) {
      if (core.kinds[i] === 'text' && core.breakableFitAdvances[i] !== null) {
        core.breakableFitAdvances[i] = null;
        core.breakablePreferredBreaks[i] = null;
      }
    }
  }
  const ws = options?.wordSpacing ?? 0;
  if (ws !== 0) {
    // css-text-3 §8: every word-separator (space) segment gains the extra
    // advance; its per-grapheme fit entries gain it per space so pre-wrap
    // preserved runs break and measure consistently.
    const core = prepared as PreparedTextWithSegments & {
      kinds: string[];
      widths: number[];
      breakableFitAdvances: (number[] | null)[];
      segments: string[];
    };
    for (let i = 0; i < core.kinds.length; i++) {
      const kind = core.kinds[i];
      if (kind !== 'space' && kind !== 'preserved-space') continue;
      core.widths[i] += ws * core.segments[i].length;
      const entries = core.breakableFitAdvances[i];
      if (entries) {
        for (let j = 0; j < entries.length; j++) entries[j] += ws * (j + 1);
      }
    }
  }
  return prepared;
}

export interface PretextLayoutLine {
  text: string;
  width: number;
}

export interface PretextLayoutResult {
  lines: PretextLayoutLine[];
  lineCount: number;
  height: number;
}

export function layoutLines(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  lineHeight: number,
): PretextLayoutResult {
  const res: LayoutLinesResult = layoutWithLines(prepared, maxWidth, lineHeight);
  return {
    lines: res.lines.map((l) => ({ text: l.text, width: l.width })),
    lineCount: res.lineCount,
    height: res.height,
  };
}

export type { LayoutCursor, LayoutLine, LayoutLineRange };
export interface PretextBreakLine {
  text: string;
  width: number;
  end: LayoutCursor;
}

export function breakNextLine(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number,
): PretextBreakLine | null {
  const range: LayoutLineRange | null = layoutNextLineRange(prepared, start, maxWidth);
  if (range === null) return null;
  const line: LayoutLine = materializeLineRange(prepared, range);
  return { text: line.text, width: line.width, end: range.end };
}
