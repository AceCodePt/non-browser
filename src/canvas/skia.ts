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
import { measureTextWithFallback } from './script-fallback.js';

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
    // Per-glyph script-run fallback (Chrome's fontconfig resolution), shared by
    // the engine's measureTextWidth and Pretext's measurement context. Returns
    // the plain single-face width when one registered face covers the string.
    const shimmed = measureTextWithFallback(
      text,
      font,
      getActiveBrowserConfig(),
      (t, f) => {
        if (f !== this.ctx.font) this.ctx.font = f;
        return this.ctx.measureText(t).width;
      },
      (family) => GlobalFonts.has(family),
    );
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
    this.ctx.font = font;
    this.ctx.fillStyle = cssColor(color);
    this.ctx.fillText(text, x, baselineY);
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
