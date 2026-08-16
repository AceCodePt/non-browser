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
  a: number;
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

  measureText(text: string, font: string): CanvasTextMetrics;

  fillRect(x: number, y: number, w: number, h: number, color: CanvasColor): void;

  /**
   * Draw glyphs for `text` starting at (x, baselineY). `baselineY` is the
   * alphabetic baseline, matching canvas fillText semantics.
   */
  drawText(text: string, x: number, baselineY: number, font: string, color: CanvasColor): void;

  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  /**
   * Add an elliptical arc to the current path (canvas `ellipse` semantics: a
   * straight line is drawn from the current point to the arc start). Angles in
   * radians, clockwise by default.
   */
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void;
  save(): void;
  restore(): void;
  clip(fillRule?: 'nonzero' | 'evenodd'): void;
  fillPath(color: CanvasColor, fillRule?: 'nonzero' | 'evenodd'): void;
  strokePath(color: CanvasColor, lineWidth: number): void;

  toBuffer(): Buffer;
}

export interface CanvasFactory {
  create(width: number, height: number): CanvasLike;
  /**
   * Register a font file (.ttf/.woff2/...). `familyAlias` optionally overrides
   * the family name the file declares, so a font can be made resolvable under a
   * specific CSS family string.
   */
  registerFont(filePath: string, familyAlias?: string): void;
}
