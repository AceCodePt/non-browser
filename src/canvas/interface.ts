/**
 * The generic Canvas interface — the seam skia/CoreText/HarfBuzz
 * implementations plug into. No skia/browser types leak into this module: it
 * only knows colors, text, shapes, and a final pixel buffer. Text is measured
 * and drawn with a CSS `font` shorthand string (e.g. `16px 'Noto Sans'`); each
 * implementation is responsible for resolving that string against the fonts it
 * has registered.
 */

export interface CanvasColor {
  r: number;
  g: number;
  b: number;
  a: number; // 0..1
}

export interface CanvasTextMetrics {
  width: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
}

/**
 * An offscreen paint surface. `measureText` and `drawText` share the same font
 * resolution, so a string's measured width is the width of what will be drawn.
 */
export interface CanvasLike {
  readonly width: number;
  readonly height: number;

  /** Measure a text run's advance for a CSS font shorthand string. */
  measureText(text: string, font: string): CanvasTextMetrics;

  /** Fill an axis-aligned rectangle with a solid color. */
  fillRect(x: number, y: number, w: number, h: number, color: CanvasColor): void;

  /**
   * Draw glyphs for `text` starting at (x, baselineY). `baselineY` is the
   * alphabetic baseline, matching canvas fillText semantics.
   */
  drawText(text: string, x: number, baselineY: number, font: string, color: CanvasColor): void;

  /** Shape path primitives (used for fill/stroke shape paint). */
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fillPath(color: CanvasColor): void;
  strokePath(color: CanvasColor, lineWidth: number): void;

  /** Composite the surface to a PNG-encoded pixel buffer. */
  toBuffer(): Buffer;
}

/** Creates surfaces and registers fonts for one Canvas implementation. */
export interface CanvasFactory {
  create(width: number, height: number): CanvasLike;
  /**
   * Register a font file (.ttf/.woff2/...). `familyAlias` optionally overrides
   * the family name the file declares, so a font can be made resolvable under a
   * specific CSS family string.
   */
  registerFont(filePath: string, familyAlias?: string): void;
}
