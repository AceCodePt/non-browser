/**
 * Paint a laid-out tree through the generic Canvas interface and collect
 * getBoundingClientRect values for every element with an `id`.
 *
 * Painting order follows CSS: in-flow block backgrounds/borders first, then
 * floats, then inline content (text) on top. Each element's background is
 * clipped to its border box. Nothing here knows about skia — surfaces and
 * primitives come from the CanvasFactory, so a CoreText/HarfBuzz implementation
 * paints the same tree unchanged.
 */

import type { CanvasFactory, CanvasLike } from '../canvas/interface.js';
import { skiaCanvasFactory } from '../canvas/skia.js';
import type { BorderStyleKeyword, Color, Side, Viewport } from './css.js';
import { SIDES } from './css.js';
import { resolveEmLength, resolveLength } from './css.js';
import { hasNonZeroRadius, innerRadii, resolveBorderRadius, traceRoundedRect, type Clip, type ResolvedRadii, type RoundedClip } from './radius.js';
import type { OpacityGroup, PaintOp, RootLayout, ShadowPaint, TextDecorationPaint, ListMarker } from './block-inline.js';
import { idOf } from './block-inline.js';
import type { Box } from './types.js';
import { cssFontString, measureTextWidth } from './measure.js';
import { fontVerticalMetrics, lineAscentContribution, roundedAscent, roundedDescent, type FontVerticalMetrics } from './fontmetrics.js';

type SideWidths = Record<Side, number>;
type SideColors = Record<Side, Color>;

export interface RenderOutput {
  width: number;
  height: number;
  rgba: Buffer;
  rects: Record<string, Box>;
  /**
   * Absolute rects of the line boxes laid out for elements that generate
   * ::before/::after content — where the engine painted the generated glyphs.
   * The verify harness uses these to place the generated text under the
   * documented text tier (Chrome cannot report pseudo text fragments).
   */
  generatedTextRects: Box[];
  /**
   * Per-element absolute line-box rects for the ids requested via
   * RenderOptions.textElements — the engine's line fragments for the elements
   * that carry inline content. Chrome reports the same geometry through
   * Range.getClientRects(), which is how the text-align verify harness diffs
   * line placement (layer-3) independently of element border boxes.
   */
  textFragments: Record<string, Box[]>;
  /**
   * Rendered marker text per element id (null for geometric markers / no
   * marker). Compared against Chrome's `::marker` text to verify ol numbering.
   */
  listMarkers: Record<string, string | null>;
}

/**
 * Paint a run's text-shadows behind its glyphs. Only the shadow is painted
 * here (blurred via the canvas shadow primitive, hard via offset draws); the
 * run's own glyphs, drawn afterwards at the same position, cover the shadow
 * primitive's shape fill. Shadows paint in reverse (last on top of the stack
 * first) so the first shadow in the list stays topmost.
 */
function paintTextShadows(
  canvas: { shadowText(text: string, x: number, baseline: number, font: string, ox: number, oy: number, blur: number, color: Color): void; drawText(text: string, x: number, baseline: number, font: string, color: Color): void },
  run: { text: string; x: number; baseline: number; fontWeight?: number; fontStyle?: 'normal' | 'italic' },
  fontSize: number,
  family: string,
  shadows: import('./css.js').Shadow[],
  viewport?: Viewport | null,
): void {
  const font = cssFontString(fontSize, family, run.fontWeight, run.fontStyle);
  const resolve = (l: import('./css.js').Length): number => resolveLength(resolveEmLength(l, fontSize), fontSize, viewport) ?? 0;
  for (let i = shadows.length - 1; i >= 0; i--) {
    const s = shadows[i];
    const ox = resolve(s.x);
    const oy = resolve(s.y);
    const blur = Math.max(0, resolve(s.blur));
    if (blur > 0) {
      canvas.shadowText(run.text, run.x + ox, run.baseline + oy, font, 0, 0, blur, s.color);
    } else {
      canvas.drawText(run.text, run.x + ox, run.baseline + oy, font, s.color);
    }
  }
}

function paintTextRun(
  canvas: { drawText(text: string, x: number, baseline: number, font: string, color: Color): void },
  run: { text: string; x: number; baseline: number; charXs?: number[]; fontWeight?: number; fontStyle?: 'normal' | 'italic' },
  fontSize: number,
  family: string,
  color: Color,
  letterSpacing: number,
): void {
  const font = cssFontString(fontSize, family, run.fontWeight, run.fontStyle);
  if (letterSpacing === 0) {
    canvas.drawText(run.text, run.x, run.baseline, font, color);
    return;
  }
  // Layout precomputes the per-character positions for letter-spaced runs
  // (layout's line/advance data, `run.charXs`), so paint never re-measures
  // prefix advances. The fallback below keeps any run that reached paint
  // without its offsets (e.g. a marker) rendering identically.
  const chars = Array.from(run.text);
  if (run.charXs) {
    for (let i = 0; i < chars.length; i++) {
      canvas.drawText(chars[i], run.x + run.charXs[i], run.baseline, font, color);
    }
    return;
  }
  // Draw glyph-by-glyph, positioning each character at its shaped prefix
  // advance (kerning preserved) plus the accumulated letter-spacing. The
  // trailing letter-spacing after the last character is accounted for in the
  // run's layout width (decorations) but paints nothing here.
  let prefix = '';
  for (let i = 0; i < chars.length; i++) {
    const x = run.x + measureTextWidth(prefix, fontSize, family, 0, run.fontWeight, run.fontStyle) + i * letterSpacing;
    canvas.drawText(chars[i], x, run.baseline, font, color);
    prefix += chars[i];
  }
}

/** Vertical content metrics Blink derives from the font (rounded to int). */
function contentMetrics(fontSize: number, vm: FontVerticalMetrics): { ascent: number; descent: number; contentHeight: number } {
  const ascent = roundedAscent(vm, fontSize);
  const descent = roundedDescent(vm, fontSize);
  return { ascent, descent, contentHeight: ascent + descent };
}

function resolveDecorationThickness(
  spec: TextDecorationPaint['thickness'],
  fontSize: number,
  vm: FontVerticalMetrics,
): number {
  let t: number;
  if (spec === 'auto') {
    t = fontSize / 10;
  } else if (spec === 'from-font') {
    t = (vm.underlineThickness / vm.unitsPerEm) * fontSize;
  } else {
    t = Math.round(spec.px);
  }
  return Math.max(1, t);
}

/**
 * Paint underline/strikethrough/overline for every line of a text op, matching
 * Blink's geometry (TextDecorationInfo/TextDecorationOffset): each line's
 * decoration spans its used text width, positioned from the font's rounded
 * ascent/descent content box. Offsets are the ones Blink produces for
 * `text-underline-position: auto` with default (zero) insets; solid style only.
 * A run's own decoration (e.g. an inline <a> underline) overrides the op-level
 * decoration.
 */
function paintDecorations(
  canvas: { fillRect(x: number, y: number, w: number, h: number, color: Color): void },
  t: NonNullable<PaintOp['text']>,
  vm: FontVerticalMetrics,
): void {
  for (const run of t.runs) {
    const decoration = run.decorationLines !== undefined ? run.decorationLines : t.decoration;
    if (!decoration) continue;
    const thickness = resolveDecorationThickness(decoration.thickness, run.fontSize ?? t.fontSize, vm);
    const drawHeight = Math.max(1, Math.floor(thickness));
    const runFontSize = run.fontSize ?? t.fontSize;
    const { ascent, descent } = contentMetrics(runFontSize, vm);
    const contentTop = run.y + (run.height - (ascent + descent)) / 2;
    for (const line of decoration.lines) {
      let top: number;
      if (line === 'underline') {
        const gap = Math.max(1, Math.ceil(thickness / 2));
        const offset = Math.round(ascent + gap + Math.round(decoration.underlineOffset));
        top = Math.floor(contentTop + offset);
      } else if (line === 'line-through') {
        const offset = (2 * ascent) / 3 - thickness / 2;
        top = Math.floor(contentTop + offset);
      } else {
        top = Math.floor(contentTop - Math.floor(thickness));
      }
      canvas.fillRect(run.x, top, run.width, drawHeight, decoration.color);
    }
  }
}

// ===== inset/outset border lighting (Blink Color::Light/Dark +
// CalculateInsetOutsetColor) =====
// Chrome lightens/darkens the border color per edge for `border-style: inset`
// (and outset) — top/left darken for inset, bottom/right for outset
// (DarkenBoxSide). Light()/Dark() reproduce platform/graphics/color.cc
// including its QuantizeTo8Bit truncation, and the lighten decision follows
// CalculateInsetOutsetColor's WebKit-matched luminance branches, so these
// borders rasterize like Chrome.

function quantizeChannel8(c01: number): number {
  // Color::QuantizeTo8Bit: truncation against the nextafter(256, 0) scale.
  return Math.trunc(c01 * 255.99998474121094);
}

function scaleColor(c: Color, mult: number): Color {
  const q = (ch: number): number => Math.min(255, Math.max(0, quantizeChannel8((ch / 255) * mult)));
  return { r: q(c.r), g: q(c.g), b: q(c.b), a: c.a };
}

/** Color::Light(): scale by min(1, v+0.33)/v; black is hardcoded to 0x545454. */
function colorLight(c: Color): Color {
  if (c.r === 0 && c.g === 0 && c.b === 0) return { r: 84, g: 84, b: 84, a: c.a };
  const v = Math.max(c.r, c.g, c.b) / 255;
  if (v === 0) return { r: 84, g: 84, b: 84, a: c.a };
  return scaleColor(c, Math.min(1, v + 0.33) / v);
}

/** Color::Dark(): scale by max(0, (v-0.33)/v); white is hardcoded to 0xABABAB. */
function colorDark(c: Color): Color {
  if (c.r === 255 && c.g === 255 && c.b === 255) return { r: 171, g: 171, b: 171, a: c.a };
  const v = Math.max(c.r, c.g, c.b) / 255;
  return scaleColor(c, v === 0 ? 0 : Math.max(0, (v - 0.33) / v));
}

/** WCAG relative luminance over the linearized sRGB channels. */
function relativeLuminance(c: Color): number {
  const lin = (ch: number): number => {
    const v = ch / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

// CalculateInsetOutsetColor's special-case thresholds: the luminances of
// rgb(32,32,32) and rgb(235,235,235).
const BASE_DARK_LUMINANCE = 0.014443844;
const BASE_LIGHT_LUMINANCE = 0.83077;

function darkenBorderColor(c: Color): Color {
  return relativeLuminance(c) <= BASE_DARK_LUMINANCE ? colorLight(c) : colorDark(c);
}

function lightenBorderColor(c: Color): Color {
  const lum = relativeLuminance(c);
  if (lum <= BASE_DARK_LUMINANCE) return colorLight(colorLight(c));
  if (lum > BASE_LIGHT_LUMINANCE) return c;
  return colorLight(c);
}

/** DarkenBoxSide: inset darkens top/left; outset darkens bottom/right. */
function darkenBoxSide(side: Side, style: BorderStyle): boolean {
  return (side === 'top' || side === 'left') === (style === 'inset');
}

function insetOutsetColor(side: Side, style: BorderStyle, base: Color): Color {
  if (style !== 'inset' && style !== 'outset') return base;
  return darkenBoxSide(side, style) ? darkenBorderColor(base) : lightenBorderColor(base);
}

function sameColor(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

type BorderStyle = BorderStyleKeyword;

function paintBorder(
  canvas: { fillRect(x: number, y: number, w: number, h: number, color: Color): void; beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void; fillPath(color: Color, rule?: string): void },
  box: Box,
  widths: SideWidths,
  colors: SideColors,
  styles: Record<Side, BorderStyle>,
): void {
  const { x, y, width, height } = box;
  const lit = (side: Side): Color => insetOutsetColor(side, styles[side] ?? 'solid', colors[side]);
  const uniform = sameColor(lit('top'), lit('right')) && sameColor(lit('top'), lit('bottom')) && sameColor(lit('top'), lit('left'));
  if (uniform) {
    const sides: { side: Side; rect: Box }[] = [
      { side: 'top', rect: { x, y, width, height: widths.top } },
      { side: 'right', rect: { x: x + width - widths.right, y, width: widths.right, height } },
      { side: 'bottom', rect: { x, y: y + height - widths.bottom, width, height: widths.bottom } },
      { side: 'left', rect: { x, y, width: widths.left, height } },
    ];
    for (const s of sides) {
      if (widths[s.side] <= 0) continue;
      canvas.fillRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height, lit(s.side));
    }
    return;
  }
  // Non-uniform side colors: Chrome miters the corners. Each corner square
  // takes the adjacent horizontal side's color, then the vertical side's
  // triangle composites over it with its anti-aliased diagonal — the single
  // 50/50 blend along the corner diagonal that Chrome's raster shows.
  const w = widths;
  const fillQuad = (pts: [number, number][], color: Color): void => {
    canvas.beginPath();
    canvas.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) canvas.lineTo(pts[i][0], pts[i][1]);
    canvas.closePath();
    canvas.fillPath(color);
  };
  canvas.fillRect(x, y, width, w.top, lit('top'));
  if (w.bottom > 0) canvas.fillRect(x, y + height - w.bottom, width, w.bottom, lit('bottom'));
  if (height - w.top - w.bottom > 0) {
    if (w.left > 0) canvas.fillRect(x, y + w.top, w.left, height - w.top - w.bottom, lit('left'));
    if (w.right > 0) canvas.fillRect(x + width - w.right, y + w.top, w.right, height - w.top - w.bottom, lit('right'));
  }
  if (w.top > 0 && w.left > 0) {
    canvas.fillRect(x, y, w.left, w.top, lit('top'));
    fillQuad([[x, y], [x, y + w.top], [x + w.left, y + w.top]], lit('left'));
  }
  if (w.top > 0 && w.right > 0) {
    canvas.fillRect(x + width - w.right, y, w.right, w.top, lit('top'));
    fillQuad([[x + width, y], [x + width, y + w.top], [x + width - w.right, y + w.top]], lit('right'));
  }
  if (w.bottom > 0 && w.right > 0) {
    canvas.fillRect(x + width - w.right, y + height - w.bottom, w.right, w.bottom, lit('bottom'));
    fillQuad([[x + width, y + height], [x + width - w.right, y + height], [x + width - w.right, y + height - w.bottom]], lit('right'));
  }
  if (w.bottom > 0 && w.left > 0) {
    canvas.fillRect(x, y + height - w.bottom, w.left, w.bottom, lit('bottom'));
    fillQuad([[x, y + height], [x, y + height - w.bottom], [x + w.left, y + height - w.bottom]], lit('left'));
  }
}

// ===== pattern border styles (dashed/dotted/double/groove/ridge) =====
// Port of Blink's BoxBorderPainter + DrawLineForBoxSide
// (core/paint/box_border_painter.cc, core/style/border_edge.cc) so each style
// rasterizes like Chrome: dash/dot patterns come from StyledStrokeData's
// fit-to-length algorithm (platform/graphics/styled_stroke_data.cc), the
// double/groove/ridge geometry from the Draw*BoxSide functions, and effective
// styles (double < 3px -> solid, groove/ridge <= 1px -> solid) from
// BorderEdge::EffectiveStyle.

const PATTERN_STYLES: readonly BorderStyle[] = ['dashed', 'dotted', 'double', 'groove', 'ridge'];

function isPatternStyle(style: BorderStyle): boolean {
  return PATTERN_STYLES.includes(style);
}

/** BorderEdge::EffectiveStyle. */
function effectiveBorderStyle(style: BorderStyle, width: number): BorderStyle {
  if ((style === 'double' && width < 3) || ((style === 'ridge' || style === 'groove') && width <= 1)) {
    return 'solid';
  }
  return style;
}

function fillsBorderArea(style: BorderStyle): boolean {
  return style !== 'dotted' && style !== 'dashed' && style !== 'double';
}

function isDottedOrDashed(style: BorderStyle): boolean {
  return style === 'dotted' || style === 'dashed';
}

/**
 * BorderStyleHasUnmatchedColorsAtCorner: inset/outset/groove/ridge pair
 * top+right and bottom+left into same-shading corners; a corner joining one
 * from each pair transitions colors mid-corner and needs a soft miter.
 */
function unmatchedColorsAtCorner(style: BorderStyle, side: Side, adjacent: Side): boolean {
  if (style !== 'inset' && style !== 'groove' && style !== 'ridge' && style !== 'outset') return false;
  const flags = (side === 'top' || side === 'right' ? 1 : 0) + (adjacent === 'top' || adjacent === 'right' ? 1 : 0);
  return flags === 0 || flags === 2;
}

// --- dashed/dotted strokes (StyledStrokeData::SetupPaint dash resolution) ---

function strokeIsDashed(width: number, style: BorderStyle): boolean {
  return style === 'dashed' || (style === 'dotted' && width <= 3);
}

/** SelectBestDashGap: stretch or squeeze the gap so whole dashes fit the path. */
function selectBestDashGap(strokeLength: number, dashLength: number, gapLength: number, closedPath: boolean): number {
  const availableLength = closedPath ? strokeLength : strokeLength + gapLength;
  const minNumDashes = Math.floor(availableLength / (dashLength + gapLength));
  const maxNumDashes = minNumDashes + 1;
  const minNumGaps = closedPath ? minNumDashes : minNumDashes - 1;
  const maxNumGaps = closedPath ? maxNumDashes : maxNumDashes - 1;
  const minGap = (strokeLength - minNumDashes * dashLength) / minNumGaps;
  const maxGap = (strokeLength - maxNumDashes * dashLength) / maxNumGaps;
  return maxGap <= 0 || Math.abs(minGap - gapLength) < Math.abs(maxGap - gapLength) ? minGap : maxGap;
}

interface DashDescription {
  on: number;
  off: number;
  cap: 'butt' | 'round';
}

/** DashEffectFromStrokeStyle: null means the stroke draws solid. */
function dashEffectFromStrokeStyle(style: BorderStyle, dashWidth: number, pathLength: number, closedPath: boolean): DashDescription | null {
  if (strokeIsDashed(dashWidth, style)) {
    let dashLength = dashWidth;
    let gapLength = dashLength;
    if (style === 'dashed') {
      // DashLengthRatio/DashGapRatio: thin lines need longer dashes and gaps.
      dashLength *= dashWidth >= 3 ? 2 : 3;
      gapLength *= dashWidth >= 3 ? 1 : 2;
    }
    if (pathLength <= dashLength * 2) return null;
    let twoDashesWithGapLength = 2 * dashLength + gapLength;
    if (closedPath) twoDashesWithGapLength += gapLength;
    if (pathLength <= twoDashesWithGapLength) {
      const multiplier = pathLength / twoDashesWithGapLength;
      return { on: dashLength * multiplier, off: gapLength * multiplier, cap: 'butt' };
    }
    const gap = style === 'dashed' ? selectBestDashGap(pathLength, dashLength, gapLength, closedPath) : gapLength;
    return { on: dashLength, off: gap, cap: 'butt' };
  }
  if (style === 'dotted') {
    // Thick dotted strokes use zero-length round-cap dashes: circles.
    const perDotLength = dashWidth * 2;
    if (pathLength < perDotLength) return { on: 0, off: perDotLength, cap: 'round' };
    const gap = selectBestDashGap(pathLength, dashWidth, dashWidth, closedPath);
    // The epsilon keeps the end dot from being dropped by measure rounding.
    return { on: 0, off: gap + dashWidth - 0.01, cap: 'round' };
  }
  return null;
}

/** EnforceDotsAtEndpoints: thin dotted lines get explicit square end dots so
 * the butt-cap dash raster never erases them; the line start/end moves to the
 * second dot when one is drawn. Mutates p1/p2 like the C++ reference args. */
function enforceDotsAtEndpoints(
  canvas: CanvasLike,
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  pathLength: number,
  width: number,
  isVerticalLine: boolean,
  color: Color,
): void {
  const mod4 = pathLength % 4;
  const mod6 = pathLength % 6;
  let useStartDot = false;
  let startDotGrowth = 0;
  let startLineOffset = 0;
  let useEndDot = false;
  let endDotGrowth = 0;
  if ((width === 1 && pathLength % 2 === 0) || (width === 3 && mod6 === 0)) {
    useStartDot = true;
    startDotGrowth = 1;
    startLineOffset = 1;
  }
  if ((width === 2 && (mod4 === 0 || mod4 === 1)) || (width === 3 && (mod6 === 1 || mod6 === 2))) {
    useStartDot = true;
    startLineOffset = -1;
  }
  if ((width === 2 && mod4 === 0) || (width === 3 && mod6 === 1)) {
    useEndDot = true;
  }
  if ((width === 2 && mod4 === 3) || (width === 3 && (mod6 === 4 || mod6 === 5))) {
    useStartDot = true;
    startLineOffset = 1;
  }
  if (width === 3 && mod6 === 5) {
    useEndDot = true;
  } else if (width === 3 && mod6 === 0) {
    useEndDot = true;
    endDotGrowth = 1;
  }
  if (!useStartDot && !useEndDot) return;
  const half = Math.floor(width / 2);
  if (useStartDot) {
    if (isVerticalLine) {
      canvas.fillRect(p1.x - half, p1.y, width, width + startDotGrowth, color);
      p1.y += 2 * width + startLineOffset;
    } else {
      canvas.fillRect(p1.x, p1.y - half, width + startDotGrowth, width, color);
      p1.x += 2 * width + startLineOffset;
    }
  }
  if (useEndDot) {
    if (isVerticalLine) {
      canvas.fillRect(p2.x - half, p2.y - width - endDotGrowth, width, width + endDotGrowth, color);
      p2.y -= width + endDotGrowth + 1;
    } else {
      canvas.fillRect(p2.x - width - endDotGrowth, p2.y - half, width + endDotGrowth, width, color);
      p2.x -= width + endDotGrowth + 1;
    }
  }
}

/** DrawDashedOrDottedBoxSide + DrawLineWithStyle: one centerline stroke for a
 * straight side; (x1,y1)-(x2,y2) is the full side band including corners. */
function drawDashedOrDottedSide(
  canvas: CanvasLike,
  side: Side,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  thickness: number,
  style: 'dashed' | 'dotted',
): void {
  const horizontal = side === 'top' || side === 'bottom';
  const width = Math.round(thickness);
  const length = horizontal ? x2 - x1 : y2 - y1;
  const p1 = horizontal ? { x: x1, y: y1 + Math.floor(thickness / 2) } : { x: x1 + Math.floor(thickness / 2), y: y1 };
  const p2 = horizontal ? { x: x2, y: p1.y } : { x: p1.x, y: y2 };
  const dash = dashEffectFromStrokeStyle(style, width, length, false);
  if (style === 'dotted') {
    if (!strokeIsDashed(width, style)) {
      // Round endcaps extend beyond the endpoints; move them in half a width.
      if (horizontal) {
        p1.x += width / 2;
        p2.x -= width / 2;
      } else {
        p1.y += width / 2;
        p2.y -= width / 2;
      }
    } else {
      enforceDotsAtEndpoints(canvas, p1, p2, length, width, !horizontal, color);
    }
  }
  // Odd widths center the stroke on the half-pixel line Chrome shifts to.
  if (width % 2 === 1) {
    if (horizontal) {
      p1.y += 0.5;
      p2.y += 0.5;
    } else {
      p1.x += 0.5;
      p2.x += 0.5;
    }
  }
  canvas.beginPath();
  canvas.moveTo(p1.x, p1.y);
  canvas.lineTo(p2.x, p2.y);
  if (dash) {
    canvas.strokePath(color, thickness, { segments: [dash.on, dash.off], cap: dash.cap });
  } else {
    canvas.strokePath(color, thickness);
  }
}

/** DrawSolidBoxSide: full band when no adjacent miter, else the mitered quad. */
function drawSolidSide(
  canvas: CanvasLike,
  side: Side,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  adjacentWidth1: number,
  adjacentWidth2: number,
): void {
  if (adjacentWidth1 === 0 && adjacentWidth2 === 0) {
    canvas.fillRect(x1, y1, x2 - x1, y2 - y1, color);
    return;
  }
  const a1p = Math.max(adjacentWidth1, 0);
  const a1n = Math.max(-adjacentWidth1, 0);
  const a2p = Math.max(adjacentWidth2, 0);
  const a2n = Math.max(-adjacentWidth2, 0);
  const pts: [number, number][] =
    side === 'top'
      ? [
          [x1 + a1n, y1],
          [x1 + a1p, y2],
          [x2 - a2p, y2],
          [x2 - a2n, y1],
        ]
      : side === 'bottom'
        ? [
            [x1 + a1p, y1],
            [x1 + a1n, y2],
            [x2 - a2n, y2],
            [x2 - a2p, y1],
          ]
        : side === 'left'
          ? [
              [x1, y1 + a1n],
              [x1, y2 - a2n],
              [x2, y2 - a2p],
              [x2, y1 + a1p],
            ]
          : [
              [x1, y1 + a1p],
              [x1, y2 - a2p],
              [x2, y2 - a2n],
              [x2, y1 + a1n],
            ];
  canvas.beginPath();
  canvas.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) canvas.lineTo(pts[i][0], pts[i][1]);
  canvas.closePath();
  canvas.fillPath(color);
}

/** DrawDoubleBoxSide: the two stripes split the border width in thirds. */
function drawDoubleSide(
  canvas: CanvasLike,
  side: Side,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  thickness: number,
  adjacentWidth1: number,
  adjacentWidth2: number,
): void {
  // (thickness + 1) / 3 truncated: Chrome's "big third" rounding.
  const third = Math.trunc((thickness + 1) / 3);
  const length = side === 'top' || side === 'bottom' ? x2 - x1 : y2 - y1;
  if (adjacentWidth1 === 0 && adjacentWidth2 === 0) {
    if (side === 'top' || side === 'bottom') {
      canvas.fillRect(x1, y1, length, third, color);
      canvas.fillRect(x1, y2 - third, length, third, color);
    } else {
      canvas.fillRect(x1, y1, third, length, color);
      canvas.fillRect(x2 - third, y1, third, length, color);
    }
    return;
  }
  const bigThird = (aw: number): number => Math.trunc(aw > 0 ? (aw + 1) / 3 : (aw - 1) / 3);
  const big1 = bigThird(adjacentWidth1);
  const big2 = bigThird(adjacentWidth2);
  // The outer line spans the full band; the inner line steps in by the
  // adjacent widths' two-thirds so the inner rectangles miss each other.
  const outerInset = (aw: number): number => Math.max(Math.trunc((1 - aw * 2) / 3), 0);
  const innerInset = (aw: number): number => Math.max(Math.trunc((1 + aw * 2) / 3), 0);
  const solid = (sx1: number, sy1: number, sx2: number, sy2: number): void =>
    drawSolidSide(canvas, side, sx1, sy1, sx2, sy2, color, big1, big2);
  if (side === 'top') {
    solid(x1 + outerInset(adjacentWidth1), y1, x2 - outerInset(adjacentWidth2), y1 + third);
    solid(x1 + innerInset(adjacentWidth1), y2 - third, x2 - innerInset(adjacentWidth2), y2);
  } else if (side === 'bottom') {
    solid(x1 + innerInset(adjacentWidth1), y1, x2 - innerInset(adjacentWidth2), y1 + third);
    solid(x1 + outerInset(adjacentWidth1), y2 - third, x2 - outerInset(adjacentWidth2), y2);
  } else if (side === 'left') {
    solid(x1, y1 + outerInset(adjacentWidth1), x1 + third, y2 - outerInset(adjacentWidth2));
    solid(x2 - third, y1 + innerInset(adjacentWidth1), x2, y2 - innerInset(adjacentWidth2));
  } else {
    solid(x1, y1 + innerInset(adjacentWidth1), x1 + third, y2 - innerInset(adjacentWidth2));
    solid(x2 - third, y1 + outerInset(adjacentWidth1), x2, y2 - outerInset(adjacentWidth2));
  }
}

/** DrawRidgeOrGrooveBoxSide: each side band splits at the middle into an
 * inset-shaded half and an outset-shaded half (groove shades like inset on
 * top/left, ridge like outset). */
function drawRidgeOrGrooveSide(
  canvas: CanvasLike,
  side: Side,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  style: 'groove' | 'ridge',
  adjacentWidth1: number,
  adjacentWidth2: number,
): void {
  const s1 = style === 'groove' ? 'inset' : 'outset';
  const s2 = style === 'groove' ? 'outset' : 'inset';
  const bigHalf = (aw: number): number => Math.trunc(aw > 0 ? (aw + 1) / 2 : (aw - 1) / 2);
  const big1 = bigHalf(adjacentWidth1);
  const big2 = bigHalf(adjacentWidth2);
  // The C++ reference halves use truncated int arithmetic: max(-aw,0)/2,
  // max(aw+1,0)/2, max(1-aw,0)/2, max(aw,0)/2.
  const h1 = (aw: number): number => Math.trunc(Math.max(-aw, 0) / 2);
  const h2 = (aw: number): number => Math.trunc(Math.max(aw + 1, 0) / 2);
  const h3 = (aw: number): number => Math.trunc(Math.max(1 - aw, 0) / 2);
  const h4 = (aw: number): number => Math.trunc(Math.max(aw, 0) / 2);
  const small1 = Math.trunc(adjacentWidth1 / 2);
  const small2 = Math.trunc(adjacentWidth2 / 2);
  const mid = side === 'top' || side === 'bottom' ? Math.trunc((y1 + y2 + 1) / 2) : Math.trunc((x1 + x2 + 1) / 2);
  const half = (halfStyle: 'inset' | 'outset', sx1: number, sy1: number, sx2: number, sy2: number, a1: number, a2: number): void => {
    drawLineForBoxSide(canvas, side, sx1, sy1, sx2, sy2, color, halfStyle, a1, a2);
  };
  if (side === 'top') {
    half(s1, x1 + h1(adjacentWidth1), y1, x2 - h1(adjacentWidth2), mid, big1, big2);
    half(s2, x1 + h2(adjacentWidth1), mid, x2 - h2(adjacentWidth2), y2, small1, small2);
  } else if (side === 'bottom') {
    half(s2, x1 + h4(adjacentWidth1), y1, x2 - h4(adjacentWidth2), mid, big1, big2);
    half(s1, x1 + h3(adjacentWidth1), mid, x2 - h3(adjacentWidth2), y2, small1, small2);
  } else if (side === 'left') {
    half(s1, x1, y1 + h1(adjacentWidth1), mid, y2 - h1(adjacentWidth2), big1, big2);
    half(s2, mid, y1 + h2(adjacentWidth1), x2, y2 - h2(adjacentWidth2), small1, small2);
  } else {
    half(s2, x1, y1 + h4(adjacentWidth1), mid, y2 - h4(adjacentWidth2), big1, big2);
    half(s1, mid, y1 + h3(adjacentWidth1), x2, y2 - h3(adjacentWidth2), small1, small2);
  }
}

/** DrawLineForBoxSide: dispatch one side band to its style's painter. */
function drawLineForBoxSide(
  canvas: CanvasLike,
  side: Side,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  style: BorderStyle,
  adjacentWidth1: number,
  adjacentWidth2: number,
): void {
  const horizontal = side === 'top' || side === 'bottom';
  const thickness = horizontal ? y2 - y1 : x2 - x1;
  const length = horizontal ? x2 - x1 : y2 - y1;
  if (length <= 0 || thickness <= 0) return;
  const effective = effectiveBorderStyle(style, thickness);
  if (effective === 'dotted' || effective === 'dashed') {
    drawDashedOrDottedSide(canvas, side, x1, y1, x2, y2, color, thickness, effective);
  } else if (effective === 'double') {
    drawDoubleSide(canvas, side, x1, y1, x2, y2, color, thickness, adjacentWidth1, adjacentWidth2);
  } else if (effective === 'groove' || effective === 'ridge') {
    drawRidgeOrGrooveSide(canvas, side, x1, y1, x2, y2, color, effective, adjacentWidth1, adjacentWidth2);
  } else if (effective === 'inset' || effective === 'outset') {
    drawSolidSide(canvas, side, x1, y1, x2, y2, insetOutsetColor(side, effective, color), adjacentWidth1, adjacentWidth2);
  } else if (effective === 'solid') {
    drawSolidSide(canvas, side, x1, y1, x2, y2, color, adjacentWidth1, adjacentWidth2);
  }
}

type MiterType = 'none' | 'soft' | 'hard';

interface StraightEdge {
  width: number;
  color: Color;
  style: BorderStyle;
  rendered: boolean;
}

/** Paint a straight-corner border that has at least one pattern-style side,
 * porting BoxBorderPainter's miter/clip decisions per side. */
function paintPatternBorderStraight(canvas: CanvasLike, op: PaintOp): void {
  const box = snapBox(op.box);
  const x1 = box.x;
  const y1 = box.y;
  const x2 = box.x + box.width;
  const y2 = box.y + box.height;
  const edges: Record<Side, StraightEdge> = {
    top: { width: Math.trunc(Math.max(0, op.borderWidths!.top)), color: op.borderColors!.top, style: op.borderStyles!.top, rendered: false },
    right: { width: Math.trunc(Math.max(0, op.borderWidths!.right)), color: op.borderColors!.right, style: op.borderStyles!.right, rendered: false },
    bottom: { width: Math.trunc(Math.max(0, op.borderWidths!.bottom)), color: op.borderColors!.bottom, style: op.borderStyles!.bottom, rendered: false },
    left: { width: Math.trunc(Math.max(0, op.borderWidths!.left)), color: op.borderColors!.left, style: op.borderStyles!.left, rendered: false },
  };
  for (const side of SIDES) {
    const e = edges[side];
    e.style = effectiveBorderStyle(e.style, e.width);
    e.rendered = e.width > 0 && e.style !== 'none' && e.style !== 'hidden' && e.color.a > 0;
  }
  if (!SIDES.some((s) => edges[s].rendered)) return;

  // Uniform double border on all four sides takes Chrome's fast path
  // (BoxBorderPainter::DrawDoubleBorder): two stripe rings at the rounded
  // thirds, no per-side clipping — corner seams stay exact.
  if (
    SIDES.every((s) => edges[s].rendered && edges[s].style === 'double' && edges[s].width === edges.top.width && sameColor(edges[s].color, edges.top.color))
  ) {
    const w = edges.top.width;
    const stripeOuter = Math.round(w / 3);
    const stripeInner = Math.round((w * 2) / 3);
    const outerStripe = snapInsetRect(x1, y1, x2 - x1, y2 - y1, stripeOuter, stripeOuter, stripeOuter, stripeOuter);
    const innerStripe = snapInsetRect(x1, y1, x2 - x1, y2 - y1, stripeInner, stripeInner, stripeInner, stripeInner);
    const innerBorder = snapInsetRect(x1, y1, x2 - x1, y2 - y1, w, w, w, w);
    const zero: ResolvedRadii = { topLeft: { rx: 0, ry: 0 }, topRight: { rx: 0, ry: 0 }, bottomRight: { rx: 0, ry: 0 }, bottomLeft: { rx: 0, ry: 0 } };
    canvas.beginPath();
    canvas.moveTo(x1, y1);
    canvas.lineTo(x2, y1);
    canvas.lineTo(x2, y2);
    canvas.lineTo(x1, y2);
    canvas.closePath();
    canvas.moveTo(outerStripe.x, outerStripe.y);
    canvas.lineTo(outerStripe.x + outerStripe.w, outerStripe.y);
    canvas.lineTo(outerStripe.x + outerStripe.w, outerStripe.y + outerStripe.h);
    canvas.lineTo(outerStripe.x, outerStripe.y + outerStripe.h);
    canvas.closePath();
    canvas.fillPath(edges.top.color, 'evenodd');
    canvas.beginPath();
    canvas.moveTo(innerStripe.x, innerStripe.y);
    canvas.lineTo(innerStripe.x + innerStripe.w, innerStripe.y);
    canvas.lineTo(innerStripe.x + innerStripe.w, innerStripe.y + innerStripe.h);
    canvas.lineTo(innerStripe.x, innerStripe.y + innerStripe.h);
    canvas.closePath();
    canvas.moveTo(innerBorder.x, innerBorder.y);
    canvas.lineTo(innerBorder.x + innerBorder.w, innerBorder.y);
    canvas.lineTo(innerBorder.x + innerBorder.w, innerBorder.y + innerBorder.h);
    canvas.lineTo(innerBorder.x, innerBorder.y + innerBorder.h);
    canvas.closePath();
    canvas.fillPath(edges.top.color, 'evenodd');
    void zero;
    return;
  }

  const sideRect = (side: Side): [number, number, number, number] => {
    const e = edges[side];
    if (side === 'top') return [x1, y1, x2, y1 + e.width];
    if (side === 'bottom') return [x1, y2 - e.width, x2, y2];
    if (side === 'left') return [x1, y1, x1 + e.width, y2];
    return [x2 - e.width, y1, x2, y2];
  };
  const clipTrapezoid = (side: Side): void => {
    const innerX1 = x1 + edges.left.width;
    const innerY1 = y1 + edges.top.width;
    const innerX2 = x2 - edges.right.width;
    const innerY2 = y2 - edges.bottom.width;
    const pts: [number, number][] =
      side === 'top'
        ? [
            [x1, y1],
            [innerX1, innerY1],
            [innerX2, innerY1],
            [x2, y1],
          ]
        : side === 'bottom'
          ? [
              [x1, y2],
              [innerX1, innerY2],
              [innerX2, innerY2],
              [x2, y2],
            ]
          : side === 'left'
            ? [
                [x1, y1],
                [innerX1, innerY1],
                [innerX1, innerY2],
                [x1, y2],
              ]
            : [
                [x2, y1],
                [innerX2, innerY1],
                [innerX2, innerY2],
                [x2, y2],
              ];
    canvas.beginPath();
    canvas.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) canvas.lineTo(pts[i][0], pts[i][1]);
    canvas.closePath();
    canvas.clip();
  };
  const computeMiter = (side: Side, adjacent: Side, completed: number): MiterType => {
    const adj = edges[adjacent];
    if (!adj.rendered) return 'none';
    const adjacentBit = 1 << SIDES.indexOf(adjacent);
    // A not-yet-painted adjacent edge that fills the border area will overdraw
    // this corner — no miter needed (WillOverdraw).
    if (!(completed & adjacentBit) && fillsBorderArea(adj.style)) return 'none';
    if (!sameColor(edges[side].color, adj.color) || unmatchedColorsAtCorner(edges[side].style, side, adjacent)) {
      return 'soft';
    }
    if (
      edges[side].style === 'double' ||
      adj.style === 'double' ||
      adj.style === 'groove' ||
      adj.style === 'ridge' ||
      isDottedOrDashed(edges[side].style) !== isDottedOrDashed(adj.style)
    ) {
      return 'hard';
    }
    return 'none';
  };

  // Chrome paints sides grouped by style (dotted/dashed/double first, then
  // inset/groove/outset/ridge, then solid) and prefers non-adjacent side
  // order (kStylePriority then kSidePriority).
  const stylePriority: Record<string, number> = { dotted: 1, dashed: 1, double: 1, inset: 2, groove: 2, outset: 2, ridge: 2, solid: 3, none: 0, hidden: 0 };
  const sidePriority: Record<Side, number> = { top: 0, bottom: 1, right: 2, left: 3 };
  const order = [...SIDES].sort(
    (a, b) => stylePriority[edges[a].style] - stylePriority[edges[b].style] || sidePriority[a] - sidePriority[b],
  );
  let completed = 0;
  for (const side of SIDES) if (!edges[side].rendered) completed |= 1 << SIDES.indexOf(side);
  for (const side of order) {
    const edge = edges[side];
    if (!edge.rendered) continue;
    const [adj1, adj2] = side === 'top' || side === 'bottom' ? (['left', 'right'] as const) : (['top', 'bottom'] as const);
    let miter1 = computeMiter(side, adj1, completed);
    let miter2 = computeMiter(side, adj2, completed);
    const shouldClip =
      miter1 === 'hard' ||
      miter2 === 'hard' ||
      ((miter1 !== 'none' || miter2 !== 'none') && (edge.style === 'dotted' || edge.style === 'dashed'));
    const [sx1, sy1, sx2, sy2] = sideRect(side);
    if (shouldClip) {
      canvas.save();
      clipTrapezoid(side);
      miter1 = 'none';
      miter2 = 'none';
    }
    drawLineForBoxSide(
      canvas,
      side,
      sx1,
      sy1,
      sx2,
      sy2,
      edge.color,
      edge.style,
      miter1 !== 'none' ? edges[adj1].width : 0,
      miter2 !== 'none' ? edges[adj2].width : 0,
    );
    if (shouldClip) canvas.restore();
    completed |= 1 << SIDES.indexOf(side);
  }
}

/** SkContourMeasure's polyline length of a rounded-rect path: the straight
 * edges count exactly and each corner conic (weight sqrt(2)/2, control at the
 * box corner) is bisected until its midpoint deviates from the chord by <=
 * 1/2px per axis (max depth 8), then summed as chords. Chrome int-truncates
 * this measured length for the closed-path dash fitting. */
function skiaRRectLength(w: number, h: number, radii: ResolvedRadii): number {
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = radii;
  const quarter = (rx: number, ry: number): number => {
    if (rx <= 0 || ry <= 0) return 0;
    // Corner-local conic: P0=(0,0), C=(rx,0), P2=(rx,ry) — congruent to every
    // corner orientation, so one parameterization serves all four.
    const evalAt = (t: number): [number, number] => {
      const u = 1 - t;
      const d = u * u + 2 * Math.SQRT1_2 * t * u + t * t;
      return [(2 * Math.SQRT1_2 * t * u * rx + t * t * rx) / d, (t * t * ry) / d];
    };
    const rec = (t0: number, t1: number, depth: number): number => {
      const a = evalAt(t0);
      const b = evalAt(t1);
      const m = evalAt((t0 + t1) / 2);
      const dev = Math.max(Math.abs(m[0] - (a[0] + b[0]) / 2), Math.abs(m[1] - (a[1] + b[1]) / 2));
      if (depth < 8 && dev > 0.5) return rec(t0, (t0 + t1) / 2, depth + 1) + rec((t0 + t1) / 2, t1, depth + 1);
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    };
    return rec(0, 1, 0);
  };
  const straight =
    Math.max(0, w - tl.rx - tr.rx) +
    Math.max(0, h - tr.ry - br.ry) +
    Math.max(0, w - br.rx - bl.rx) +
    Math.max(0, h - tl.ry - bl.ry);
  return straight + quarter(tl.rx, tl.ry) + quarter(tr.rx, tr.ry) + quarter(br.rx, br.ry) + quarter(bl.rx, bl.ry);
}

/** FloatRoundedRect::Radii::Outset with negative outsets: each nonzero
 * component shrinks by its side's inset. */
function insetRadii(outer: ResolvedRadii, l: number, t: number, r: number, b: number): ResolvedRadii {
  const shrink = (v: number, d: number): number => (v > 0 ? Math.max(0, v - d) : 0);
  return {
    topLeft: { rx: shrink(outer.topLeft.rx, l), ry: shrink(outer.topLeft.ry, t) },
    topRight: { rx: shrink(outer.topRight.rx, r), ry: shrink(outer.topRight.ry, t) },
    bottomRight: { rx: shrink(outer.bottomRight.rx, r), ry: shrink(outer.bottomRight.ry, b) },
    bottomLeft: { rx: shrink(outer.bottomLeft.rx, l), ry: shrink(outer.bottomLeft.ry, b) },
  };
}

function clampRadii(radii: ResolvedRadii, w: number, h: number): ResolvedRadii {
  const c = (p: { rx: number; ry: number }): { rx: number; ry: number } => ({
    rx: Math.min(p.rx, w / 2),
    ry: Math.min(p.ry, h / 2),
  });
  return { topLeft: c(radii.topLeft), topRight: c(radii.topRight), bottomRight: c(radii.bottomRight), bottomLeft: c(radii.bottomLeft) };
}

/** Chrome's pixel snapping for an outset/inset border rect
 * (SnapSizeToPixelAllowingZero): round each edge independently. */
function snapInsetRect(
  x: number,
  y: number,
  w: number,
  h: number,
  l: number,
  t: number,
  r: number,
  b: number,
): { x: number; y: number; w: number; h: number } {
  const x0 = Math.round(x + l);
  const y0 = Math.round(y + t);
  const x1 = Math.round(x + w - r);
  const y1 = Math.round(y + h - b);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

function traceRing(canvas: CanvasLike, a: { x: number; y: number; w: number; h: number }, ra: ResolvedRadii, b: { x: number; y: number; w: number; h: number } | null, rb: ResolvedRadii, color: Color): void {
  canvas.beginPath();
  traceRoundedRect(canvas, a.x, a.y, a.w, a.h, clampRadii(ra, a.w, a.h));
  if (b && b.w > 0 && b.h > 0) traceRoundedRect(canvas, b.x, b.y, b.w, b.h, clampRadii(rb, b.w, b.h));
  canvas.fillPath(color, 'evenodd');
}

/** BorderWillArcInnerEdge: the side follows a curved path when either of its
 * inner corner radii is nonzero. */
function sideWillArc(side: Side, inner: ResolvedRadii): boolean {
  const pair =
    side === 'top'
      ? [inner.topLeft, inner.topRight]
      : side === 'bottom'
        ? [inner.bottomLeft, inner.bottomRight]
        : side === 'left'
          ? [inner.topLeft, inner.bottomLeft]
          : [inner.topRight, inner.bottomRight];
  return pair.some((c) => c.rx > 0 || c.ry > 0);
}

/** Paint a rounded border with at least one pattern-style side. The ring
 * (outer minus inner rounded rect) is the global clip, matching Chrome's
 * ClipContouredRect(outer) + ClipOutContouredRect(inner); each style then
 * paints its band inside it. */
function paintPatternBorderRounded(canvas: CanvasLike, op: PaintOp, viewport?: Viewport | null): void {
  const box = op.box;
  const sx = Math.round(box.x);
  const sy = Math.round(box.y);
  const sw = Math.round(box.x + box.width) - sx;
  const sh = Math.round(box.y + box.height) - sy;
  const widthsF = op.borderWidths!;
  const widths: Record<Side, number> = {
    top: Math.trunc(Math.max(0, widthsF.top)),
    right: Math.trunc(Math.max(0, widthsF.right)),
    bottom: Math.trunc(Math.max(0, widthsF.bottom)),
    left: Math.trunc(Math.max(0, widthsF.left)),
  };
  const colors = op.borderColors!;
  const rawStyles = op.borderStyles!;
  const styles: Record<Side, BorderStyle> = {
    top: effectiveBorderStyle(rawStyles.top, widths.top),
    right: effectiveBorderStyle(rawStyles.right, widths.right),
    bottom: effectiveBorderStyle(rawStyles.bottom, widths.bottom),
    left: effectiveBorderStyle(rawStyles.left, widths.left),
  };
  const rendered = SIDES.filter((s) => widths[s] > 0 && styles[s] !== 'none' && styles[s] !== 'hidden' && colors[s].a > 0);
  if (rendered.length === 0) return;

  const outer = resolveBorderRadius(op.borderRadius!, box.width, box.height, viewport);
  const inner = innerRadii(outer, widthsF, box.width, box.height);
  const innerRect = snapInsetRect(sx, sy, sw, sh, widthsF.left, widthsF.top, widthsF.right, widthsF.bottom);
  const centerRect = snapInsetRect(sx, sy, sw, sh, widthsF.left / 2, widthsF.top / 2, widthsF.right / 2, widthsF.bottom / 2);
  const centerRadii = insetRadii(outer, widthsF.left / 2, widthsF.top / 2, widthsF.right / 2, widthsF.bottom / 2);

  canvas.save();
  canvas.beginPath();
  traceRoundedRect(canvas, sx, sy, sw, sh, clampRadii(outer, sw, sh));
  if (innerRect.w > 0 && innerRect.h > 0) {
    traceRoundedRect(canvas, innerRect.x, innerRect.y, innerRect.w, innerRect.h, clampRadii(inner, innerRect.w, innerRect.h));
  }
  canvas.clip('evenodd');

  const sideBand = (side: Side): [number, number, number, number] => {
    if (side === 'top') return [sx, sy, sx + sw, sy + widths.top];
    if (side === 'bottom') return [sx, sy + sh - widths.bottom, sx + sw, sy + sh];
    if (side === 'left') return [sx, sy, sx + widths.left, sy + sh];
    return [sx + sw - widths.right, sy, sx + sw, sy + sh];
  };
  // The corner quad from the outer corners to the inner (padding-box)
  // corners: Chrome's side polygon for a straight miter, which splits each
  // corner along the outer-to-inner diagonal.
  const clipSideQuad = (side: Side): void => {
    const pts: [number, number][] =
      side === 'top'
        ? [
            [sx, sy],
            [innerRect.x, innerRect.y],
            [innerRect.x + innerRect.w, innerRect.y],
            [sx + sw, sy],
          ]
        : side === 'bottom'
          ? [
              [sx, sy + sh],
              [innerRect.x, innerRect.y + innerRect.h],
              [innerRect.x + innerRect.w, innerRect.y + innerRect.h],
              [sx + sw, sy + sh],
            ]
          : side === 'left'
            ? [
                [sx, sy],
                [innerRect.x, innerRect.y],
                [innerRect.x, innerRect.y + innerRect.h],
                [sx, sy + sh],
              ]
            : [
                [sx + sw, sy],
                [innerRect.x + innerRect.w, innerRect.y],
                [innerRect.x + innerRect.w, innerRect.y + innerRect.h],
                [sx + sw, sy + sh],
              ];
    canvas.beginPath();
    canvas.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) canvas.lineTo(pts[i][0], pts[i][1]);
    canvas.closePath();
    canvas.clip();
  };

  // Dashed/dotted: curved sides stroke the closed centerline path (Chrome's
  // DrawCurvedDashedDottedBoxSide fat stroke, trimmed by the ring clip);
  // straight sides keep their full-length centerlines. The stroke runs once
  // per style — Chrome paints per side under side clips, so re-stroking the
  // whole path per side would multi-composite the anti-aliased dash edges.
  const dashedDotted = rendered.filter((s) => styles[s] === 'dashed' || styles[s] === 'dotted');
  const strokedStyles = new Set<string>();
  for (const side of dashedDotted) {
    const style = styles[side] as 'dashed' | 'dotted';
    if (strokedStyles.has(style)) continue;
    strokedStyles.add(style);
    if (sideWillArc(side, inner)) {
      const perim = Math.trunc(skiaRRectLength(centerRect.w, centerRect.h, centerRadii));
      const dash = dashEffectFromStrokeStyle(style, widths[side], perim, true);
      const strokeThickness = Math.max(...rendered.map((s) => widths[s]));
      // The stroke is doubled (plus AA headroom) because half of it is
      // clipped off; the ring clip restores the real band width.
      const thickness = strokeIsDashed(widths[side], style) ? strokeThickness * 2.2 : widths[side];
      canvas.beginPath();
      traceRoundedRect(canvas, centerRect.x, centerRect.y, centerRect.w, centerRect.h, clampRadii(centerRadii, centerRect.w, centerRect.h));
      if (dash) {
        canvas.strokePath(colors[side], thickness, { segments: [dash.on, dash.off], cap: dash.cap });
      } else {
        canvas.strokePath(colors[side], thickness);
      }
    } else {
      const [bx1, by1, bx2, by2] = sideBand(side);
      drawDashedOrDottedSide(canvas, side, bx1, by1, bx2, by2, colors[side], widths[side], style);
    }
  }

  // Double: uniform width/color on all four sides takes Chrome's fast path —
  // two rounded stripe rings at the rounded thirds (roundf(w/3), roundf(2w/3)).
  const doubles = rendered.filter((s) => styles[s] === 'double');
  if (doubles.length === 4 && new Set(doubles.map((s) => widths[s])).size === 1 && doubles.every((s) => sameColor(colors[s], colors.top))) {
    const w = widths.top;
    const stripeOuter = Math.round(w / 3);
    const stripeInner = Math.round((w * 2) / 3);
    const outerStripeRect = snapInsetRect(sx, sy, sw, sh, stripeOuter, stripeOuter, stripeOuter, stripeOuter);
    const innerStripeRect = snapInsetRect(sx, sy, sw, sh, stripeInner, stripeInner, stripeInner, stripeInner);
    const outerStripeRadii = insetRadii(outer, stripeOuter, stripeOuter, stripeOuter, stripeOuter);
    const innerStripeRadii = insetRadii(outer, stripeInner, stripeInner, stripeInner, stripeInner);
    traceRing(canvas, { x: sx, y: sy, w: sw, h: sh }, outer, outerStripeRect, outerStripeRadii, colors.top);
    traceRing(canvas, innerStripeRect, innerStripeRadii, innerRect, inner, colors.top);
  } else {
    for (const side of doubles) {
      const [bx1, by1, bx2, by2] = sideBand(side);
      drawDoubleSide(canvas, side, bx1, by1, bx2, by2, colors[side], widths[side], 0, 0);
    }
  }

  // Groove/ridge: per side, fill the side's ring region with the outer-half
  // shading, then the region inside the centerline contour with the inner-half
  // shading (DrawCurvedRidgeGrooveBoxSide).
  const grooveRidge = rendered.filter((s) => styles[s] === 'groove' || styles[s] === 'ridge');
  for (const side of grooveRidge) {
    const outerDarken = darkenBoxSide(side, styles[side] === 'groove' ? 'inset' : 'outset');
    canvas.save();
    clipSideQuad(side);
    canvas.fillRect(sx, sy, sw, sh, outerDarken ? darkenBorderColor(colors[side]) : lightenBorderColor(colors[side]));
    canvas.save();
    canvas.beginPath();
    traceRoundedRect(canvas, centerRect.x, centerRect.y, centerRect.w, centerRect.h, clampRadii(centerRadii, centerRect.w, centerRect.h));
    canvas.clip();
    canvas.fillRect(sx, sy, sw, sh, outerDarken ? lightenBorderColor(colors[side]) : darkenBorderColor(colors[side]));
    canvas.restore();
    canvas.restore();
  }

  // Solid/inset/outset sides keep their lighting, clipped to their side quad.
  for (const side of rendered) {
    if (styles[side] !== 'solid' && styles[side] !== 'inset' && styles[side] !== 'outset') continue;
    canvas.save();
    clipSideQuad(side);
    canvas.fillRect(sx, sy, sw, sh, insetOutsetColor(side, styles[side], colors[side]));
    canvas.restore();
  }

  canvas.restore();
}

function hasResolvedRadius(r: ResolvedRadii): boolean {
  const c = [r.topLeft, r.topRight, r.bottomRight, r.bottomLeft];
  return c.some((k) => k.rx > 0 || k.ry > 0);
}

/** Fill a rounded rectangle for a background op, matching Chrome's raster. */
function paintRoundedBackground(
  canvas: CanvasLike,
  op: PaintOp,
  viewport?: Viewport | null,
): void {
  const radii = resolveBorderRadius(op.borderRadius!, op.box.width, op.box.height, viewport);
  if (!hasResolvedRadius(radii)) {
    canvas.fillRect(op.box.x, op.box.y, op.box.width, op.box.height, op.color!);
    return;
  }
  canvas.beginPath();
  traceRoundedRect(canvas, op.box.x, op.box.y, op.box.width, op.box.height, radii);
  canvas.fillPath(op.color!);
}

/** Paint one list marker. Geometric markers use Blink's bullet box: a filled
 * disc / 1px-outline circle / filled square inscribed in a `shapeSize` box at
 * the marker's center; decimal counters draw the suffix text at its x. */
function paintListMarker(canvas: CanvasLike, op: PaintOp): void {
  const m = op.marker!;
  if (m.kind === 'disc' && m.centerX !== undefined && m.centerY !== undefined) {
    const r = m.shapeSize! / 2;
    canvas.beginPath();
    canvas.moveTo(m.centerX + r, m.centerY);
    canvas.ellipse(m.centerX, m.centerY, r, r, 0, 0, Math.PI * 2, false);
    canvas.fillPath(m.color);
  } else if (m.kind === 'circle' && m.centerX !== undefined && m.centerY !== undefined) {
    const r = m.shapeSize! / 2;
    const hole = m.shapeSize! / 4;
    canvas.beginPath();
    canvas.moveTo(m.centerX + r, m.centerY);
    canvas.ellipse(m.centerX, m.centerY, r, r, 0, 0, Math.PI * 2, false);
    canvas.moveTo(m.centerX + hole, m.centerY);
    canvas.ellipse(m.centerX, m.centerY, hole, hole, 0, 0, Math.PI * 2, false);
    canvas.fillPath(m.color, 'evenodd');
  } else if (m.kind === 'square' && m.centerX !== undefined && m.centerY !== undefined) {
    const s = m.shapeSize!;
    canvas.fillRect(m.centerX - s / 2, m.centerY - s / 2, s, s, m.color);
  } else if (m.kind === 'decimal' && m.text !== undefined && m.baseline !== undefined && m.x !== undefined) {
    canvas.drawText(m.text, m.x, m.baseline, cssFontString(m.fontSize, m.family), m.color);
  }
}

function paintRoundedBorder(
  canvas: CanvasLike,
  op: PaintOp,
  viewport?: Viewport | null,
): void {
  const widths = op.borderWidths!;
  const colors = op.borderColors!;
  const outer = resolveBorderRadius(op.borderRadius!, op.box.width, op.box.height, viewport);
  const inner = innerRadii(outer, widths, op.box.width, op.box.height);
  const traceRing = (): void => {
    traceRoundedRect(canvas, op.box.x, op.box.y, op.box.width, op.box.height, outer);
    traceRoundedRect(
      canvas,
      op.box.x + widths.left,
      op.box.y + widths.top,
      op.box.width - widths.left - widths.right,
      op.box.height - widths.top - widths.bottom,
      inner,
    );
  };

  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const uniform = sides.every(
    (s) => colors.top.r === colors[s].r && colors.top.g === colors[s].g && colors.top.b === colors[s].b && colors.top.a === colors[s].a,
  );
  if (uniform) {
    canvas.beginPath();
    traceRing();
    canvas.fillPath(colors.top, 'evenodd');
    return;
  }

  const bands = [
    { x: op.box.x, y: op.box.y, w: op.box.width, h: widths.top, color: colors.top },
    { x: op.box.x + op.box.width - widths.right, y: op.box.y, w: widths.right, h: op.box.height, color: colors.right },
    { x: op.box.x, y: op.box.y + op.box.height - widths.bottom, w: op.box.width, h: widths.bottom, color: colors.bottom },
    { x: op.box.x, y: op.box.y, w: widths.left, h: op.box.height, color: colors.left },
  ];
  for (const b of bands) {
    if (b.h <= 0 || b.w <= 0) continue;
    canvas.save();
    canvas.beginPath();
    canvas.moveTo(b.x, b.y);
    canvas.lineTo(b.x + b.w, b.y);
    canvas.lineTo(b.x + b.w, b.y + b.h);
    canvas.lineTo(b.x, b.y + b.h);
    canvas.closePath();
    canvas.clip();
    canvas.beginPath();
    traceRing();
    canvas.fillPath(b.color, 'evenodd');
    canvas.restore();
  }
}

function applyRoundedClip(canvas: CanvasLike, clip: RoundedClip, viewport?: Viewport | null): void {
  const radii = resolveBorderRadius(clip.radii, clip.width, clip.height, viewport);
  traceRoundedRect(canvas, clip.x, clip.y, clip.width, clip.height, radii);
  canvas.clip();
}

/** Intersect the current path with a clip entry — a plain rect or a rounded
 * rect — and set it as the canvas clip. Rect clips reuse the path so hard
 * (non-AA) clip edges raster like Chrome's. */
function applyClip(canvas: CanvasLike, clip: Clip, viewport?: Viewport | null): void {
  if ('radii' in clip && hasNonZeroRadius(clip.radii)) {
    applyRoundedClip(canvas, clip, viewport);
    return;
  }
  canvas.moveTo(clip.x, clip.y);
  canvas.lineTo(clip.x + clip.width, clip.y);
  canvas.lineTo(clip.x + clip.width, clip.y + clip.height);
  canvas.lineTo(clip.x, clip.y + clip.height);
  canvas.closePath();
  canvas.clip();
}

/**
 * Paint one box-shadow op. Solid shadows paint Chrome's sharp shape — the box
 * (or its inner frame for inset) translated by offset and expanded by spread —
 * matching Chrome at blur 0 exactly. Blurred shadows use the canvas shadow
 * primitive (Chrome's kernel) over the box rect; their shape fill is covered
 * by the box background painted after, which is why the blur primitive is only
 * selected for opaque backgrounds with no spread.
 */
function paintShadow(canvas: CanvasLike, op: PaintOp, viewport?: Viewport | null): void {
  const s = op.shadow!;
  const { x, y, width, height } = op.box;
  if (s.render === 'blurred') {
    if (s.borderRadius && hasNonZeroRadius(s.borderRadius)) {
      canvas.save();
      canvas.beginPath();
      traceRoundedRect(canvas, x, y, width, height, resolveBorderRadius(s.borderRadius, width, height, viewport));
      canvas.shadowPath(s.ox, s.oy, s.blur, s.color);
      canvas.restore();
    } else {
      canvas.shadowRect(x, y, width, height, s.ox, s.oy, s.blur, s.color);
    }
    return;
  }
  if (!s.inset) {
    const sx = x + s.ox - s.spread;
    const sy = y + s.oy - s.spread;
    const sw = width + 2 * s.spread;
    const sh = height + 2 * s.spread;
    // An outer shadow paints the shadow shape minus the box's border-box hole
    // (css-backgrounds-3 §6.1.1) — over a transparent element the shadow must
    // not show through the box itself. Rounded shapes use one evenodd path so
    // the hole is a single composite; plain shapes use four hard band fills.
    if (s.borderRadius && hasNonZeroRadius(s.borderRadius)) {
      canvas.save();
      canvas.beginPath();
      traceRoundedRect(canvas, sx, sy, sw, sh, resolveBorderRadius(s.borderRadius, sw, sh, viewport));
      traceRoundedRect(canvas, x, y, width, height, resolveBorderRadius(s.borderRadius, width, height, viewport));
      canvas.fillPath(s.color, 'evenodd');
      canvas.restore();
      return;
    }
    const holeRight = x + width;
    const holeBottom = y + height;
    const topH = y - sy;
    const bottomH = sy + sh - holeBottom;
    const leftW = x - sx;
    const rightW = sx + sw - holeRight;
    if (topH > 0) canvas.fillRect(sx, sy, sw, topH, s.color);
    if (bottomH > 0) canvas.fillRect(sx, holeBottom, sw, bottomH, s.color);
    if (leftW > 0) canvas.fillRect(sx, Math.max(sy, y), leftW, Math.max(0, Math.min(sy + sh, holeBottom) - Math.max(sy, y)), s.color);
    if (rightW > 0) canvas.fillRect(holeRight, Math.max(sy, y), rightW, Math.max(0, Math.min(sy + sh, holeBottom) - Math.max(sy, y)), s.color);
    return;
  }
  // Inset: the shadow is the box minus the hole rect
  // (box translated by offset, shrunk by spread on every side), clipped to the
  // border box — four band fills so fractional frame edges stay non-AA like
  // Chrome's hard raster.
  const hx = x + s.ox + s.spread;
  const hy = y + s.oy + s.spread;
  const hw = width - 2 * s.spread;
  const hh = height - 2 * s.spread;
  canvas.save();
  if (s.borderRadius && hasNonZeroRadius(s.borderRadius)) {
    canvas.beginPath();
    traceRoundedRect(canvas, x, y, width, height, resolveBorderRadius(s.borderRadius, width, height, viewport));
    canvas.clip();
  }
  const right = x + width;
  const bottom = y + height;
  const holeRight = hx + hw;
  const holeBottom = hy + hh;
  const topH = hy - y;
  const bottomH = bottom - holeBottom;
  const leftW = hx - x;
  const rightW = right - holeRight;
  if (topH > 0) canvas.fillRect(x, y, width, topH, s.color);
  if (bottomH > 0) canvas.fillRect(x, holeBottom, width, bottomH, s.color);
  if (leftW > 0) canvas.fillRect(x, Math.max(y, hy), Math.min(leftW, width), Math.max(0, Math.min(bottom, holeBottom) - Math.max(y, hy)), s.color);
  if (rightW > 0) canvas.fillRect(Math.max(x, holeRight), Math.max(y, hy), Math.min(rightW, width), Math.max(0, Math.min(bottom, holeBottom) - Math.max(y, hy)), s.color);
  canvas.restore();
}

/**
 * Blink paints a box background on the pixel-snapped border box:
 * IntRect(round(x0), round(y0), round(x1)-round(x0), round(y1)-round(y0)), so a
 * background at a fractional layout position never produces anti-aliased edges.
 */
function snapBox(b: Box): Box {
  const x0 = Math.round(b.x);
  const y0 = Math.round(b.y);
  const x1 = Math.round(b.x + b.width);
  const y1 = Math.round(b.y + b.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
export function paint(
  root: RootLayout,
  viewportWidth: number,
  viewportHeight: number,
  ids: string[],
  fontFile?: string,
  factory: CanvasFactory = skiaCanvasFactory,
  viewport?: Viewport | null,
  textElements?: string[],
  encode: boolean = true,
): RenderOutput {
  const canvas = factory.create(viewportWidth, viewportHeight);
  canvas.fillRect(0, 0, viewportWidth, viewportHeight, root.canvasBackground);

  const fontMetrics = fontFile ? fontVerticalMetrics(fontFile) : null;

  const scopeItems = buildPaintScene(root);
  renderSequence(canvas, scopeItems(null), factory, viewport, viewportWidth, viewportHeight, fontMetrics, scopeItems);

  const rects = root.rects;
  const generatedTextRects: Box[] = [];
  collectGeneratedTextRects(root, generatedTextRects);
  const textFragments: Record<string, Box[]> = {};
  if (textElements && textElements.length > 0) collectTextFragments(root, textElements, textFragments, fontMetrics);
  const listMarkers: Record<string, string | null> = {};
  collectListMarkers(root, listMarkers);
  const missing: string[] = [];
  for (const id of ids) if (!rects[id]) missing.push(id);
  if (missing.length > 0) {
    throw new Error(`layout: no rect collected for id(s): ${missing.join(', ')}`);
  }
  return {
    width: viewportWidth,
    height: viewportHeight,
    rgba: encode ? canvas.toBuffer() : canvas.toRawBuffer(),
    rects,
    generatedTextRects,
    textFragments,
    listMarkers,
  };
}

/**
 * An item paint.ts draws at one z-order position: either a bare op or an
 * opacity<1 subtree surface (which renders atomically). Both carry a stacking
 * key + order so a mixed sequence sorts exactly as the flat op list did.
 */
type PaintItem =
  | { kind: 'op'; op: PaintOp }
  | { kind: 'group'; group: OpacityGroup };

function itemKey(item: PaintItem): number[] {
  return item.kind === 'op' ? item.op.key : item.group.key;
}

function itemOrder(item: PaintItem): number {
  return item.kind === 'op' ? item.op.order : item.group.order;
}

function compareItems(a: PaintItem, b: PaintItem): number {
  const ka = itemKey(a);
  const kb = itemKey(b);
  const n = Math.min(ka.length, kb.length);
  for (let i = 0; i < n; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  const dl = ka.length - kb.length;
  if (dl !== 0) return dl;
  return itemOrder(a) - itemOrder(b);
}

function scopeItemsOf(root: RootLayout, byGroup: Map<number, PaintOp[]>, parent: number | null): PaintItem[] {
  const items: PaintItem[] = [];
  const ops = parent === null ? byGroup.get(-1) ?? [] : byGroup.get(parent) ?? [];
  for (const op of ops) items.push({ kind: 'op', op });
  for (const [, g] of root.opacityGroups) {
    if (g.parent === parent) items.push({ kind: 'group', group: g });
  }
  items.sort(compareItems);
  return items;
}

function buildPaintScene(root: RootLayout) {
  const byGroup = new Map<number, PaintOp[]>();
  byGroup.set(-1, []);
  for (const op of root.paints) {
    const g = op.group;
    const key = g === undefined || g === null ? -1 : g;
    let bucket = byGroup.get(key);
    if (!bucket) {
      bucket = [];
      byGroup.set(key, bucket);
    }
    bucket.push(op);
  }
  return (parent: number | null): PaintItem[] => scopeItemsOf(root, byGroup, parent);
}

/**
 * Paint an atomic opacity group's subtree into a transparent offscreen surface
 * and blend it onto `canvas` at the group's alpha. level 0 drops the subtree
 * from paint entirely while layout/frame geometry is untouched.
 */
function renderGroup(
  canvas: CanvasLike,
  group: OpacityGroup,
  factory: CanvasFactory,
  viewport: Viewport | null | undefined,
  vw: number,
  vh: number,
  fontMetrics: FontVerticalMetrics | null,
  scopeItems: (parent: number | null) => PaintItem[],
): void {
  if (group.level === 0) return;
  const off = factory.createOffscreen?.(vw, vh) ?? factory.create(vw, vh);
  renderSequence(off, scopeItems(group.id), factory, viewport, vw, vh, fontMetrics, scopeItems);
  canvas.drawImage(off, group.level);
}

function renderSequence(
  canvas: CanvasLike,
  items: PaintItem[],
  factory: CanvasFactory,
  viewport: Viewport | null | undefined,
  vw: number,
  vh: number,
  fontMetrics: FontVerticalMetrics | null,
  scopeItems: (parent: number | null) => PaintItem[],
): void {
  for (const item of items) {
    if (item.kind === 'op') {
      paintOp(canvas, item.op, viewport, fontMetrics);
      continue;
    }
    renderGroup(canvas, item.group, factory, viewport, vw, vh, fontMetrics, scopeItems);
  }
}

function paintOp(canvas: CanvasLike, op: PaintOp, viewport: Viewport | null | undefined, fontMetrics: FontVerticalMetrics | null): void {
  const clipped = op.clip != null;
  if (clipped) {
    canvas.save();
    canvas.beginPath();
    applyClip(canvas, op.clip!, viewport);
  }
  if (op.kind === 'bg') {
    if (op.borderRadius && hasNonZeroRadius(op.borderRadius)) {
      paintRoundedBackground(canvas, op, viewport);
    } else {
      const b = snapBox(op.box);
      canvas.fillRect(b.x, b.y, b.width, b.height, op.color!);
    }
  } else if (op.kind === 'border') {
    const styles = op.borderStyles ?? { top: 'solid' as const, right: 'solid' as const, bottom: 'solid' as const, left: 'solid' as const };
    if (SIDES.some((s) => isPatternStyle(styles[s]))) {
      if (op.borderRadius && hasNonZeroRadius(op.borderRadius)) {
        paintPatternBorderRounded(canvas, op, viewport);
      } else {
        paintPatternBorderStraight(canvas, op);
      }
    } else if (op.borderRadius && hasNonZeroRadius(op.borderRadius)) {
      paintRoundedBorder(canvas, op, viewport);
    } else {
      paintBorder(canvas, op.box, op.borderWidths!, op.borderColors!, styles);
    }
  } else if (op.kind === 'shadow') {
    paintShadow(canvas, op, viewport);
  } else if (op.kind === 'text') {
    const t = op.text!;
    for (const run of t.runs) {
      const fontSize = run.fontSize ?? t.fontSize;
      const family = run.family ?? t.family;
      const color = run.color ?? t.color;
      const letterSpacing = run.letterSpacing ?? t.letterSpacing;
      if (t.textShadow.length > 0) paintTextShadows(canvas, run, fontSize, family, t.textShadow, viewport);
      paintTextRun(canvas, run, fontSize, family, color, letterSpacing);
    }
    if (fontMetrics) {
      paintDecorations(canvas, t, fontMetrics);
    }
  } else if (op.kind === 'marker') {
    paintListMarker(canvas, op);
  }
  if (clipped) canvas.restore();
}

/**
 * Collect the rendered marker text per list-item id (null for geometric
 * markers and `list-style-type: none`). The verify harness compares these
 * against Chrome's `::marker` text to prove ol renumbering matches.
 */
function collectListMarkers(root: RootLayout, out: Record<string, string | null>): void {
  const walk = (node: RootLayout['root']): void => {
    const id = idOf(node.element);
    if (id && node.marker) out[id] = node.marker.text ?? null;
    for (const child of node.children) walk(child);
  };
  walk(root.root);
}

/**
 * Collect the line-box rects of elements that generate ::before/::after text
 * (their lines already carry absolute coordinates). These are the generated
 * glyph regions the verify harness compares under the text tier.
 */
function collectGeneratedTextRects(root: RootLayout, out: Box[]): void {
  const walk = (node: RootLayout['root']): void => {
    const s = node.style;
    if (node.lines.length > 0 && (s.before !== null || s.after !== null)) {
      for (const l of node.lines) {
        out.push({ x: l.x, y: l.y, width: l.width, height: l.height });
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(root.root);
}

/**
 * Collect the absolute text-box rects of the requested text elements. Chrome's
 * Range.getClientRects() reports each line's text box (the font's rounded
 * ascent/descent content box, positioned by half-leading within the line box),
 * not the full line-height box — so each fragment rect is `baseline − ascent`
 * tall `ascent + descent`, matching the oracle exactly. The inline layout
 * writes the aligned positions into `node.lines`, so this is the engine's view
 * of the line fragments the text-align harness diffs (layer-3).
 */
function collectTextFragments(
  root: RootLayout,
  textElements: string[],
  out: Record<string, Box[]>,
  metrics: FontVerticalMetrics | null,
): void {
  const walk = (node: RootLayout['root']): void => {
    const id = idOf(node.element);
    if (id && textElements.includes(id) && node.lines.length > 0) {
      out[id] = node.lines.map((l) => {
        const fs = l.fontSize ?? node.style.fontSize;
        const a = metrics ? roundedAscent(metrics, fs) : 0;
        const d = metrics ? roundedDescent(metrics, fs) : 0;
        const baseline = l.baseline ?? l.y + lineAscentContribution(fs, l.height, metrics);
        return { x: l.x, y: baseline - a, width: l.width, height: a + d };
      });
    }
    for (const child of node.children) walk(child);
  };
  walk(root.root);
}
