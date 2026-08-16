/**
 * Skia implementation of the generic Canvas interface, offscreen only, riding
 * @napi-rs/canvas. Fonts are registered from files (.ttf/.woff2/...) through
 * `GlobalFonts`, so the same typeface serves measurement, paint, and the Chrome
 * oracle (which is pointed at the same font files). Nothing skia-specific
 * appears in the interface this implements.
 */

import { createCanvas, GlobalFonts, type Canvas as NapiCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import type { CanvasColor, CanvasFactory, CanvasLike, CanvasTextMetrics } from './interface.js';
import { getActiveBrowserConfig } from '../config/browser-config.js';
import { measureTextWithFallback, resolveFallbackRuns } from './script-fallback.js';
import { measureTextWithTabs } from './tabs.js';

function cssColor(c: CanvasColor): string {
  if (c.a === 0) return 'rgba(0,0,0,0)';
  if (c.a >= 1) return `rgb(${c.r},${c.g},${c.b})`;
  return `rgba(${c.r},${c.g},${c.b},${c.a})`;
}

export class SkiaCanvas implements CanvasLike {
  private readonly canvas: NapiCanvas;
  private readonly ctx: SKRSContext2D;

  constructor(canvas: NapiCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.textBaseline = 'alphabetic';
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  measureText(text: string, font: string): CanvasTextMetrics {
    this.ctx.font = font;
    const m = this.ctx.measureText(text);
    const config = getActiveBrowserConfig();
    const measure = (t: string, f: string): number => {
      if (f !== this.ctx.font) this.ctx.font = f;
      return this.ctx.measureText(t).width;
    };
    const hasFamily = (family: string): boolean => GlobalFonts.has(family);
    // A tab-bearing string is measured by the tab shim (which applies the
    // per-glyph fallback to each non-tab segment), so the whole-string
    // script-run shim below only ever runs on tab-free text.
    const tabbed = measureTextWithTabs(text, font, config, measure, hasFamily);
    // Per-glyph script-run fallback (Chrome's fontconfig resolution), shared by
    // the engine's measureTextWidth and Pretext's measurement context. Returns
    // the plain single-face width when one registered face covers the string.
    const shimmed = tabbed ?? measureTextWithFallback(text, font, config, measure, hasFamily);
    return {
      width: shimmed ?? m.width,
      actualBoundingBoxAscent: m.actualBoundingBoxAscent ?? 0,
      actualBoundingBoxDescent: m.actualBoundingBoxDescent ?? 0,
      actualBoundingBoxLeft: m.actualBoundingBoxLeft ?? 0,
      actualBoundingBoxRight: m.actualBoundingBoxRight ?? 0,
    };
  }

  fillRect(x: number, y: number, w: number, h: number, color: CanvasColor): void {
    this.ctx.fillStyle = cssColor(color);
    this.ctx.fillRect(x, y, w, h);
  }

  drawText(text: string, x: number, baselineY: number, font: string, color: CanvasColor): void {
    const config = getActiveBrowserConfig();
    const hasFamily = (family: string): boolean => GlobalFonts.has(family);
    // Paint the same per-run faces the measurement shim resolves, each run at
    // its accumulated advance, so painted glyphs match the measured width (and
    // Chrome's per-glyph fallback) instead of one face painting the whole
    // mixed-script string.
    const runs = resolveFallbackRuns(text, font, config, hasFamily);
    this.ctx.fillStyle = cssColor(color);
    if (runs === null) {
      this.ctx.font = font;
      this.ctx.fillText(text, x, baselineY);
      return;
    }
    const measure = (t: string, f: string): number => {
      if (f !== this.ctx.font) this.ctx.font = f;
      return this.ctx.measureText(t).width;
    };
    let advance = 0;
    for (const run of runs) {
      this.ctx.font = run.font;
      this.ctx.fillText(run.text, x + advance, baselineY);
      advance += measure(run.text, run.font);
    }
  }

  beginPath(): void {
    this.ctx.beginPath();
  }

  moveTo(x: number, y: number): void {
    this.ctx.moveTo(x, y);
  }

  lineTo(x: number, y: number): void {
    this.ctx.lineTo(x, y);
  }

  closePath(): void {
    this.ctx.closePath();
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void {
    this.ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise ?? false);
  }

  save(): void {
    this.ctx.save();
  }

  restore(): void {
    this.ctx.restore();
  }

  clip(fillRule: 'nonzero' | 'evenodd' = 'nonzero'): void {
    this.ctx.clip(fillRule);
  }

  fillPath(color: CanvasColor, fillRule: 'nonzero' | 'evenodd' = 'nonzero'): void {
    this.ctx.fillStyle = cssColor(color);
    this.ctx.fill(fillRule);
  }

  strokePath(color: CanvasColor, lineWidth: number): void {
    this.ctx.strokeStyle = cssColor(color);
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();
  }

  toBuffer(): Buffer {
    return this.canvas.toBuffer('image/png');
  }
}

export class SkiaCanvasFactory implements CanvasFactory {
  create(width: number, height: number): CanvasLike {
    return new SkiaCanvas(createCanvas(width, height));
  }

  registerFont(filePath: string, familyAlias?: string): void {
    const key = GlobalFonts.registerFromPath(filePath, familyAlias);
    if (key === null) {
      throw new Error(`skia: failed to register font from ${filePath}`);
    }
  }
}

export const skiaCanvasFactory: CanvasFactory = new SkiaCanvasFactory();
