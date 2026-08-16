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
  layoutWithLines,
  prepareWithSegments,
  type LayoutLinesResult,
  type PrepareOptions,
  type PreparedTextWithSegments,
} from '@chenglou/pretext';
import type { CanvasLike } from '../canvas/interface.js';
import { getActiveBrowserConfig, resolveFontFamily } from '../config/browser-config.js';

export type { PrepareOptions };

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
 * Install the global OffscreenCanvas shim used by Pretext's measurement.
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

/** Prepare a text run for Pretext layout over the Canvas interface. */
export function prepareText(
  text: string,
  font: string,
  options?: PrepareOptions,
): PreparedTextWithSegments {
  return prepareWithSegments(text, font, options);
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

/** Lay out prepared text at a fixed width/line-height, mapping Pretext lines to plain shapes. */
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
