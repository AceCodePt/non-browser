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
import { cachedFamilyHas, cachedMetrics, cachedResolvedRuns, invalidateMeasureCache } from './measure-cache.js';
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

  /** Return this surface to its freshly-created state (all-transparent), so a
   * pooled canvas can be repainted without the previous frame's pixels showing
   * through a translucent background fill. A fresh napi canvas starts fully
   * transparent, so clear() makes a pooled surface byte-equivalent to a new
   * one before the render paints over it. */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  measureText(text: string, font: string): CanvasTextMetrics {
    // The width shim (tabs + script-run fallback) only runs on a cache miss;
    // repeated break-candidate re-measures hit the memo instead. A fresh object
    // is returned each call so callers cannot mutate the shared cache entry.
    const cached = cachedMetrics(font, text, () => {
      this.ctx.font = font;
      const m = this.ctx.measureText(text);
      const config = getActiveBrowserConfig();
      const measure = (t: string, f: string): number => {
        if (f !== this.ctx.font) this.ctx.font = f;
        return this.ctx.measureText(t).width;
      };
      // GlobalFonts.has pays a native round-trip (~0.17ms); the family probe is
      // memoized per font-registration epoch, so resolveFallbackRuns's
      // per-grapheme hasFamily calls stop re-paying it.
      const hasFamily = (family: string): boolean => cachedFamilyHas(family, (f) => GlobalFonts.has(f));
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
    });
    return {
      width: cached.width,
      actualBoundingBoxAscent: cached.actualBoundingBoxAscent,
      actualBoundingBoxDescent: cached.actualBoundingBoxDescent,
      actualBoundingBoxLeft: cached.actualBoundingBoxLeft,
      actualBoundingBoxRight: cached.actualBoundingBoxRight,
    };
  }

  fillRect(x: number, y: number, w: number, h: number, color: CanvasColor): void {
    this.ctx.fillStyle = cssColor(color);
    this.ctx.fillRect(x, y, w, h);
  }

  drawText(text: string, x: number, baselineY: number, font: string, color: CanvasColor): void {
    const config = getActiveBrowserConfig();
    const hasFamily = (family: string): boolean => cachedFamilyHas(family, (f) => GlobalFonts.has(f));
    const measure = (t: string, f: string): number => {
      if (f !== this.ctx.font) this.ctx.font = f;
      return this.ctx.measureText(t).width;
    };
    // Paint the same per-run faces the measurement shim resolves, each run at
    // its accumulated advance, so painted glyphs match the measured width (and
    // Chrome's per-glyph fallback) instead of one face painting the whole
    // mixed-script string. The runs and their advances are memoized per epoch
    // (cachedResolvedRuns), so a warm render re-paints identical split + widths
    // without re-running shorthand parsing, script segmentation, or the native
    // per-run measures.
    const resolved = cachedResolvedRuns(font, text, () => {
      const runs = resolveFallbackRuns(text, font, config, hasFamily);
      if (runs === null) return null;
      return runs.map((run) => ({ ...run, width: measure(run.text, run.font) }));
    });
    this.ctx.fillStyle = cssColor(color);
    if (resolved === null) {
      this.ctx.font = font;
      this.ctx.fillText(text, x, baselineY);
      return;
    }
    let advance = 0;
    for (const run of resolved) {
      this.ctx.font = run.font;
      this.ctx.fillText(run.text, x + advance, baselineY);
      advance += run.width;
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

  shadowPath(offsetX: number, offsetY: number, blurRadius: number, color: CanvasColor): void {
    this.ctx.save();
    this.ctx.shadowColor = cssColor(color);
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
    this.ctx.shadowBlur = blurRadius;
    this.ctx.fillStyle = '#000';
    this.ctx.fill();
    this.ctx.restore();
  }

  shadowRect(x: number, y: number, w: number, h: number, offsetX: number, offsetY: number, blurRadius: number, color: CanvasColor): void {
    this.ctx.save();
    this.ctx.shadowColor = cssColor(color);
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
    this.ctx.shadowBlur = blurRadius;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.restore();
  }

  shadowText(text: string, x: number, baselineY: number, font: string, offsetX: number, offsetY: number, blurRadius: number, color: CanvasColor): void {
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.shadowColor = cssColor(color);
    this.ctx.shadowOffsetX = offsetX;
    this.ctx.shadowOffsetY = offsetY;
    this.ctx.shadowBlur = blurRadius;
    this.ctx.fillStyle = '#000';
    this.ctx.fillText(text, x, baselineY);
    this.ctx.restore();
  }

  drawImage(source: CanvasLike, alpha = 1): void {
    const src = source instanceof SkiaCanvas ? source.canvas : null;
    if (!src) throw new Error('skia: drawImage requires a SkiaCanvas surface');
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(src, 0, 0);
    this.ctx.restore();
  }

  toBuffer(): Buffer {
    return this.canvas.toBuffer('image/png');
  }

  toRawBuffer(): Buffer {
    return this.canvas.data();
  }
}

/** Reusing a surface across renders skips the native first-readback cost a
 * fresh canvas pays (the pixels are materialized on the first `data()` call),
 * and `data()` after repainting is far cheaper than on a fresh surface. The
 * caller paints a full-viewport background every render, and create() clears
 * the pooled surface back to transparent first, so the repainted pixels are
 * byte-identical to a fresh canvas. The pool is bounded and keyed by size; the
 * engine's render path is synchronous, so a pooled surface is never touched by
 * two renders at once. */
const POOL_CAP = 8;

export class SkiaCanvasFactory implements CanvasFactory {
  private readonly pool = new Map<string, SkiaCanvas>();

  create(width: number, height: number): CanvasLike {
    const key = `${width}x${height}`;
    const pooled = this.pool.get(key);
    if (pooled) {
      pooled.clear();
      return pooled;
    }
    const canvas = new SkiaCanvas(createCanvas(width, height));
    if (this.pool.size >= POOL_CAP) {
      const oldest = this.pool.keys().next().value;
      if (oldest !== undefined) this.pool.delete(oldest);
    }
    this.pool.set(key, canvas);
    return canvas;
  }

  registerFont(filePath: string, familyAlias?: string): void {
    const key = GlobalFonts.registerFromPath(filePath, familyAlias);
    if (key === null) {
      throw new Error(`skia: failed to register font from ${filePath}`);
    }
    // A genuinely new face flips every cached family probe and width, so the
    // measure epoch ends here (a stale cached width across a real registration
    // is a bug). Re-registering a pair render.ts already registered (every
    // prepare() registers the whole config font set) is idempotent for the
    // answers GlobalFonts returns, so it must not wipe the memo — that is what
    // keeps the cache warm across repeated renders of the same config.
    const pair = familyAlias === undefined ? `\u0000${filePath}` : `${familyAlias}\u0000${filePath}`;
    if (registeredFonts.has(pair)) return;
    registeredFonts.add(pair);
    invalidateMeasureCache();
  }
}

/** Pairs already registered into GlobalFonts this process (see registerFont). */
const registeredFonts = new Set<string>();

export const skiaCanvasFactory: CanvasFactory = new SkiaCanvasFactory();
