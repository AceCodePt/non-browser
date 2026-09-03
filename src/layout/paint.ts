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
import type { Color, Side, Viewport } from './css.js';
import { resolveEmLength, resolveLength } from './css.js';
import { hasNonZeroRadius, innerRadii, resolveBorderRadius, traceRoundedRect, type Clip, type ResolvedCorner, type ResolvedRadii, type RoundedClip, type SideWidths, ZERO_RESOLVED_RADII } from './radius.js';
import { canvasStops, linearEndpoints, radialGeometry, type BackgroundLayer, type BgRepeat, type BgSizeComponent, type BoxKeyword } from './background.js';
import type { OpacityGroup, PaintOp, RootLayout, ShadowPaint, TextDecorationPaint, ListMarker } from './block-inline.js';
import { idOf } from './block-inline.js';
import type { Box } from './types.js';
import { cssFontString, measureTextWidth } from './measure.js';
import { fontVerticalMetrics, lineAscentContribution, roundedAscent, roundedDescent, type FontVerticalMetrics } from './fontmetrics.js';

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

// ===== inset/outset border lighting (Blink Color::Light/Dark/BlendWithWhite) =====
// Blink lightens/darkens the border color per edge for `border-style: inset`
// (and outset): top = Dark(), bottom/right = Light(), left = BlendWithWhite().
// These reproduce `platform/graphics/color.cc` exactly, so an inset 1px gray
// border rasterizes identically to Chrome.

function scaleChannel(c: number, mult: number): number {
  return Math.min(255, Math.max(0, Math.round(c * mult)));
}

/** Color::Light(): multiply by min(1, (v+0.33)/v) where v is the max channel. */
function colorLight(c: Color): Color {
  if (c.r === 0 && c.g === 0 && c.b === 0) return { r: 84, g: 84, b: 84, a: c.a };
  const v = Math.max(c.r, c.g, c.b) / 255;
  const mult = Math.min(1, (v + 0.33) / v);
  return { r: scaleChannel(c.r, mult), g: scaleChannel(c.g, mult), b: scaleChannel(c.b, mult), a: c.a };
}

/** Color::Dark(): multiply by max(0, (v-0.33)/v) where v is the max channel. */
function colorDark(c: Color): Color {
  if (c.r === 255 && c.g === 255 && c.b === 255) return { r: 171, g: 171, b: 171, a: c.a };
  const v = Math.max(c.r, c.g, c.b) / 255;
  const mult = v === 0 ? 0 : Math.max(0, (v - 0.33) / v);
  return { r: scaleChannel(c.r, mult), g: scaleChannel(c.g, mult), b: scaleChannel(c.b, mult), a: c.a };
}

/** Color::BlendWithWhite() composited over a white canvas (the page). */
function blendWithWhite(c: Color): Color {
  for (const alpha of [153, 170, 187, 204]) {
    if (c.r >= 255 - alpha && c.g >= 255 - alpha && c.b >= 255 - alpha) {
      const a = alpha / 255;
      const white = 255 - alpha;
      const comp = (ch: number): number => Math.trunc((ch - white) / a);
      const r = comp(c.r);
      const g = comp(c.g);
      const b = comp(c.b);
      return {
        r: Math.round(r * a + 255 * (1 - a)),
        g: Math.round(g * a + 255 * (1 - a)),
        b: Math.round(b * a + 255 * (1 - a)),
        a: c.a,
      };
    }
  }
  return c;
}

type BorderStyle = 'none' | 'solid' | 'inset' | 'outset';

function insetEdgeColor(style: BorderStyle, side: 'top' | 'right' | 'bottom' | 'left', base: Color): Color {
  if (style !== 'inset' && style !== 'outset') return base;
  const inset = style === 'inset';
  switch (side) {
    case 'top':
      return inset ? colorDark(base) : colorLight(base);
    case 'bottom':
      return inset ? colorLight(base) : colorDark(base);
    case 'right':
      return inset ? colorLight(base) : colorDark(base);
    case 'left':
      return inset ? blendWithWhite(base) : blendWithWhite(base);
  }
}

function sameColor(a: Color, b: Color): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function paintBorder(
  canvas: { fillRect(x: number, y: number, w: number, h: number, color: Color): void; beginPath(): void; moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void; fillPath(color: Color, rule?: string): void },
  box: Box,
  widths: SideWidths,
  colors: SideColors,
  styles: Record<Side, BorderStyle>,
): void {
  const { x, y, width, height } = box;
  const lit = (side: Side): Color => insetEdgeColor(styles[side] ?? 'solid', side, colors[side]);
  const uniform = sameColor(lit('top'), lit('right')) && sameColor(lit('top'), lit('bottom')) && sameColor(lit('top'), lit('left'));
  if (uniform) {
    // Non-overlapping bands: a semi-transparent border color must composite
    // once per pixel (Chrome draws each border side once), so the left/right
    // bands exclude the top/bottom bands instead of overlapping at corners.
    const sides: { side: Side; rect: Box }[] = [
      { side: 'top', rect: { x, y, width, height: widths.top } },
      { side: 'bottom', rect: { x, y: y + height - widths.bottom, width, height: widths.bottom } },
      { side: 'left', rect: { x, y: y + widths.top, width: widths.left, height: Math.max(0, height - widths.top - widths.bottom) } },
      { side: 'right', rect: { x: x + width - widths.right, y: y + widths.top, width: widths.right, height: Math.max(0, height - widths.top - widths.bottom) } },
    ];
    for (const s of sides) {
      if (widths[s.side] <= 0 || s.rect.width <= 0 || s.rect.height <= 0) continue;
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

// ===== background layers (css-backgrounds-3 §5-§9, css-images-3 §3) =====

/** The border/padding/content box of a background layer, inset from the
 * border box per the layer's box keyword. */
function layerBox(box: Box, widths: SideWidths, padding: SideWidths, keyword: BoxKeyword): Box {
  if (keyword === 'border-box') return box;
  const left = keyword === 'padding-box' ? widths.left : widths.left + padding.left;
  const right = keyword === 'padding-box' ? widths.right : widths.right + padding.right;
  const top = keyword === 'padding-box' ? widths.top : widths.top + padding.top;
  const bottom = keyword === 'padding-box' ? widths.bottom : widths.bottom + padding.bottom;
  return {
    x: box.x + left,
    y: box.y + top,
    width: Math.max(0, box.width - left - right),
    height: Math.max(0, box.height - top - bottom),
  };
}

function sizeComponentPx(c: BgSizeComponent, ref: number): number {
  if (c.auto) return ref;
  if (c.pct !== null) return (c.pct / 100) * ref;
  return c.px ?? 0;
}

/**
 * Tile origins for one axis. `repeat` extends from the positioned origin in
 * both directions (tiles may straddle the positioning area edge). `round`
 * rescales the tile so an integer count fits the positioning area; `space`
 * distributes equal gaps between floor(span/tile) tiles — both anchored at
 * the positioning-area origin (css-backgrounds-3 §6).
 */
function tileOrigins(
  axis: BgRepeat['x'],
  origin: number,
  tile: number,
  areaStart: number,
  areaSpan: number,
  clipStart: number,
  clipSpan: number,
): number[] {
  if (tile <= 0) return [origin];
  if (axis === 'no-repeat') return [origin];
  if (axis === 'repeat') {
    const out: number[] = [];
    const kMin = Math.floor((clipStart - origin) / tile);
    const kMax = Math.ceil((clipStart + clipSpan - origin) / tile);
    for (let k = kMin; k <= kMax; k++) out.push(origin + k * tile);
    return out;
  }
  if (axis === 'round') {
    const n = Math.max(1, Math.round(areaSpan / tile));
    const tile2 = areaSpan / n;
    const out: number[] = [];
    const kMin = Math.floor((clipStart - areaStart) / tile2);
    const kMax = Math.ceil((clipStart + clipSpan - areaStart) / tile2);
    for (let k = kMin; k <= kMax; k++) out.push(areaStart + k * tile2);
    return out;
  }
  // space: fewer tiles, equal gaps; a single tile sits at the positioned origin
  const n = Math.floor(areaSpan / tile);
  if (n < 2) return [origin];
  const gap = (areaSpan - n * tile) / (n - 1);
  const out: number[] = [];
  const step = tile + gap;
  const kMin = Math.floor((clipStart - areaStart) / step);
  const kMax = Math.ceil((clipStart + clipSpan - areaStart) / step);
  for (let k = kMin; k <= kMax; k++) out.push(areaStart + k * step);
  return out;
}

function fillGradientTile(canvas: CanvasLike, layer: BackgroundLayer, tile: Box): void {
  if (tile.width <= 0 || tile.height <= 0) return;
  const image = layer.image;
  if (image.kind === 'linear') {
    const e = linearEndpoints(image.gradient, tile.width, tile.height);
    const stops = canvasStops(image.gradient, Math.hypot(e.x1 - e.x0, e.y1 - e.y0));
    if (stops.length === 0) return;
    canvas.fillGradientRect(tile.x, tile.y, tile.width, tile.height, {
      type: 'linear',
      x0: tile.x + e.x0,
      y0: tile.y + e.y0,
      x1: tile.x + e.x1,
      y1: tile.y + e.y1,
      stops,
    });
    return;
  }
  if (image.kind === 'radial') {
    const g = radialGeometry(image.gradient, tile.width, tile.height);
    if (g.rx <= 0 && g.ry <= 0) return;
    // Percentage stops resolve against the ending radius (the horizontal one
    // for an ellipse — the scaled-circle shader's unit distance).
    const stops = canvasStops(image.gradient, Math.max(g.rx, 1e-6));
    if (stops.length === 0) return;
    canvas.fillGradientRect(tile.x, tile.y, tile.width, tile.height, {
      type: 'radial',
      cx: tile.x + g.cx,
      cy: tile.y + g.cy,
      rx: g.rx,
      ry: g.ry,
      stops,
    });
  }
}

/**
 * Paint one background-image layer: size and position it in its positioning
 * (origin) box, clip to its clip box (radii adjusted per box keyword), and
 * fill every repeat tile. url() layers paint nothing (chartered-out raster
 * decode, docs/ledgers/backgrounds.md). A `fixed` attachment positions the
 * image in the viewport (the scroll-0 positioning area for a static renderer)
 * while clipping to the element's clip box, per css-backgrounds-3 §6.
 */
function paintBackgroundLayer(
  canvas: CanvasLike,
  layer: BackgroundLayer,
  borderBox: Box,
  widths: SideWidths,
  padding: SideWidths,
  outerRadii: ResolvedRadii | null,
  viewport: Viewport | null | undefined,
): void {
  if (layer.image.kind !== 'linear' && layer.image.kind !== 'radial') return;
  const origin = layerBox(borderBox, widths, padding, layer.origin);
  const clipBox = layerBox(borderBox, widths, padding, layer.clip);
  const fixed = layer.attachment === 'fixed' && viewport;
  const area = fixed ? { x: 0, y: 0, width: viewport!.width, height: viewport!.height } : origin;
  const sw = layer.size.type === 'keywords' ? area.width : sizeComponentPx(layer.size.w, area.width);
  const sh = layer.size.type === 'keywords' ? area.height : sizeComponentPx(layer.size.h, area.height);
  const px = (layer.position.x.pct / 100) * (area.width - sw) + layer.position.x.px;
  const py = (layer.position.y.pct / 100) * (area.height - sh) + layer.position.y.px;
  const img = { x: area.x + px, y: area.y + py, width: sw, height: sh };

  let clipRadii: ResolvedRadii | null = null;
  if (outerRadii) {
    if (layer.clip === 'padding-box') {
      clipRadii = innerRadii(outerRadii, widths, borderBox.width, borderBox.height);
    } else if (layer.clip === 'content-box') {
      clipRadii = innerRadii(innerRadii(outerRadii, widths, borderBox.width, borderBox.height), padding, borderBox.width, borderBox.height);
    } else {
      clipRadii = outerRadii;
    }
  }

  canvas.save();
  canvas.beginPath();
  if (clipRadii && hasResolvedRadius(clipRadii)) {
    traceRoundedRect(canvas, clipBox.x, clipBox.y, clipBox.width, clipBox.height, clipRadii);
  } else {
    canvas.moveTo(clipBox.x, clipBox.y);
    canvas.lineTo(clipBox.x + clipBox.width, clipBox.y);
    canvas.lineTo(clipBox.x + clipBox.width, clipBox.y + clipBox.height);
    canvas.lineTo(clipBox.x, clipBox.y + clipBox.height);
    canvas.closePath();
  }
  canvas.clip();
  const xs = tileOrigins(layer.repeat.x, img.x, img.width, area.x, area.width, clipBox.x, clipBox.width);
  const ys = tileOrigins(layer.repeat.y, img.y, img.height, area.y, area.height, clipBox.y, clipBox.height);
  for (const ty of ys) {
    for (const tx of xs) {
      fillGradientTile(canvas, layer, { x: tx, y: ty, width: img.width, height: img.height });
    }
  }
  canvas.restore();
}

/**
 * Paint one 'bg' op: the background color (rounded when the element has a
 * border-radius), then the image layers last-to-first (the first layer paints
 * on top, css-backgrounds-3 §9.1). The color paints within the LAST layer's
 * background-clip region (css-backgrounds-3 §7.4: the color travels with the
 * final layer's clip), radii-adjusted for that box.
 */
function paintBackgroundOp(canvas: CanvasLike, op: PaintOp, viewport?: Viewport | null): void {
  const b = snapBox(op.box);
  const radii =
    op.borderRadius && hasNonZeroRadius(op.borderRadius)
      ? resolveBorderRadius(op.borderRadius, op.box.width, op.box.height, viewport)
      : null;
  const bg = op.background;
  if (op.color && op.color.a > 0) {
    let colorClip: Box = b;
    let colorRadii: ResolvedRadii | null = radii;
    if (bg && bg.layers.length > 0) {
      const last = bg.layers[bg.layers.length - 1];
      if (last.clip !== 'border-box') {
        colorClip = layerBox(b, bg.widths, bg.padding, last.clip);
        if (radii) {
          colorRadii =
            last.clip === 'padding-box'
              ? innerRadii(radii, bg.widths, b.width, b.height)
              : innerRadii(innerRadii(radii, bg.widths, b.width, b.height), bg.padding, b.width, b.height);
        }
      }
    }
    canvas.save();
    canvas.beginPath();
    if (colorRadii && hasResolvedRadius(colorRadii)) {
      traceRoundedRect(canvas, colorClip.x, colorClip.y, colorClip.width, colorClip.height, colorRadii);
    } else {
      canvas.moveTo(colorClip.x, colorClip.y);
      canvas.lineTo(colorClip.x + colorClip.width, colorClip.y);
      canvas.lineTo(colorClip.x + colorClip.width, colorClip.y + colorClip.height);
      canvas.lineTo(colorClip.x, colorClip.y + colorClip.height);
      canvas.closePath();
    }
    canvas.clip();
    canvas.fillRect(colorClip.x, colorClip.y, colorClip.width, colorClip.height, op.color);
    canvas.restore();
  }
  if (!bg) return;
  for (let i = bg.layers.length - 1; i >= 0; i--) {
    paintBackgroundLayer(canvas, bg.layers[i], b, bg.widths, bg.padding, radii, viewport);
  }
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
 * IntRect(round(x0), round(y0), round(x1)-round(x0), round(y1)-round(x0)), so a
 * background at a fractional layout position never produces anti-aliased edges.
 */
function snapBox(b: Box): Box {
  const x0 = Math.round(b.x);
  const y0 = Math.round(b.y);
  const x1 = Math.round(b.x + b.width);
  const y1 = Math.round(b.y + b.height);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// ===== outline (css-ui-4 §4) =====
// The outline is a separate paint pass outside the border box: the ring
// occupies [offset, offset+width] beyond the border box and follows the
// border-radius contour (a rounded rect expanded by t grows each corner radius
// by t). Geometry mirrors Blink's OutlinePainter: the outline rect is
// pixel-snapped, a negative offset clamps per axis to half the box, the
// center line sits floor(width/2) inside the outer edge ("prefer outer"), and
// dotted/dashed strokes restart per edge with the dash pattern fitted to the
// extended line.

interface OutlineRing {
  outer: Box;
  inner: Box;
  outerRadii: ResolvedRadii;
  innerRadii: ResolvedRadii;
  center: Box;
  centerRadii: ResolvedRadii;
  rounded: boolean;
  /** the per-axis clamped offsets the ring was built with. */
  oH: number;
  oV: number;
}

function expandRadii(r: ResolvedRadii, t: number): ResolvedRadii {
  const grow = (c: ResolvedCorner): ResolvedCorner => ({ rx: Math.max(0, c.rx + t), ry: Math.max(0, c.ry + t) });
  return {
    topLeft: grow(r.topLeft),
    topRight: grow(r.topRight),
    bottomRight: grow(r.bottomRight),
    bottomLeft: grow(r.bottomLeft),
  };
}

function outlineRing(box: Box, borderRadius: ResolvedRadii | null, offset: number, width: number): OutlineRing {
  // A negative offset never shrinks the rendered outline past half the box
  // (css-ui-4 §4.4; Blink clamps per axis with integer division).
  const oH = Math.max(offset, -Math.floor(box.width / 2));
  const oV = Math.max(offset, -Math.floor(box.height / 2));
  const rounded = borderRadius !== null && hasResolvedRadius(borderRadius);
  const base = borderRadius ?? ZERO_RESOLVED_RADII;
  const outer = {
    x: box.x - oH - width,
    y: box.y - oV - width,
    width: box.width + 2 * (oH + width),
    height: box.height + 2 * (oV + width),
  };
  const inner = { x: box.x - oH, y: box.y - oV, width: box.width + 2 * oH, height: box.height + 2 * oV };
  const shrink = Math.floor(width / 2);
  const center = { x: outer.x + shrink, y: outer.y + shrink, width: outer.width - 2 * shrink, height: outer.height - 2 * shrink };
  const outerRadii = reduceOverlapRadii(expandRadii(base, oH + width), expandRadii(base, oV + width), outer);
  const innerRadii = reduceOverlapRadii(expandRadii(base, oH), expandRadii(base, oV), inner);
  const centerRadii = reduceOverlapRadii(
    expandRadii(base, oH + width - shrink),
    expandRadii(base, oV + width - shrink),
    center,
  );
  return { outer, inner, outerRadii, innerRadii, center, centerRadii, rounded, oH, oV };
}

/** Reduce each axis' radii against its own box, the §4.3 overlapping-curves rule. */
function reduceOverlapRadii(rx: ResolvedRadii, ry: ResolvedRadii, box: Box): ResolvedRadii {
  const merged: ResolvedRadii = {
    topLeft: { rx: rx.topLeft.rx, ry: ry.topLeft.ry },
    topRight: { rx: rx.topRight.rx, ry: ry.topRight.ry },
    bottomRight: { rx: rx.bottomRight.rx, ry: ry.bottomRight.ry },
    bottomLeft: { rx: rx.bottomLeft.rx, ry: ry.bottomLeft.ry },
  };
  if (box.width <= 0 || box.height <= 0) return merged;
  const f = Math.min(
    1,
    box.width / (merged.topLeft.rx + merged.topRight.rx),
    box.height / (merged.topRight.ry + merged.bottomRight.ry),
    box.width / (merged.bottomRight.rx + merged.bottomLeft.rx),
    box.height / (merged.bottomLeft.ry + merged.topLeft.ry),
  );
  if (f >= 1 || !Number.isFinite(f)) return merged;
  const scale = (c: ResolvedCorner): ResolvedCorner => ({ rx: c.rx * f, ry: c.ry * f });
  return {
    topLeft: scale(merged.topLeft),
    topRight: scale(merged.topRight),
    bottomRight: scale(merged.bottomRight),
    bottomLeft: scale(merged.bottomLeft),
  };
}

function traceBoxPath(canvas: CanvasLike, b: Box, radii: ResolvedRadii, rounded: boolean): void {
  if (rounded) {
    traceRoundedRect(canvas, b.x, b.y, b.width, b.height, radii);
    return;
  }
  canvas.moveTo(b.x, b.y);
  canvas.lineTo(b.x + b.width, b.y);
  canvas.lineTo(b.x + b.width, b.y + b.height);
  canvas.lineTo(b.x, b.y + b.height);
  canvas.closePath();
}

/** Clip to the outline ring (outer edge minus inner edge), caller restores. */
function clipOutlineRing(canvas: CanvasLike, ring: OutlineRing): void {
  canvas.beginPath();
  traceBoxPath(canvas, ring.outer, ring.outerRadii, ring.rounded);
  traceBoxPath(canvas, ring.inner, ring.innerRadii, ring.rounded);
  canvas.clip('evenodd');
}

/**
 * The dash pattern Chrome fits to an outline edge, measured against the
 * raster: widths 1-2 fit [3w, 2w] periods, widths 3+ fit [2w, w] periods.
 * `period0` is the unfitted period, `dashFrac` the dash share of it; the fit
 * scales both so n whole periods fill the extended line exactly.
 */
function dashPattern(width: number): { period0: number; dashFrac: number } {
  return width <= 2 ? { period0: 5 * width, dashFrac: 3 / 5 } : { period0: 3 * width, dashFrac: 2 / 3 };
}

/**
 * Dash geometry for one straight edge, matching Chrome's raster (probed at
 * widths 1-6): the dash chain starts at the ring's outer edge and the period
 * is fitted so n whole periods fill the outer span plus 4px (2 each side);
 * the pattern is [3w, 2w]-based for widths 1-2 and [2w, w]-based for 3+. The
 * band quad centers on the band with the odd-width bump (+2), which the ring
 * clip reduces to the visible band.
 */
function paintDashedEdge(
  canvas: CanvasLike,
  outerStart: number,
  span: number,
  bandStart: number,
  width: number,
  horizontal: boolean,
  color: Color,
  fitW: number,
): void {
  const len = span + 2 * width + 4;
  const { period0, dashFrac } = dashPattern(fitW);
  const n = Math.max(1, Math.ceil(len / period0));
  const period = len / n;
  const dash = period * dashFrac;
  const thickness = width + (width % 2 === 1 ? 2 : 0);
  const half = thickness / 2;
  const mid = bandStart + width / 2;
  for (let k = 0; ; k++) {
    const s = outerStart + k * period;
    if (s >= outerStart + len) break;
    if (horizontal) canvas.fillRect(s, mid - half, dash, thickness, color);
    else canvas.fillRect(mid - half, s, thickness, dash, color);
  }
}

/**
 * Dot placement for one straight edge, matching Chrome's raster (probed at
 * widths 1-6): the line extends joint = (w+1)/2 past each corner, the first
 * dot centers at ext + w/2, subsequent dots at ext + k·2w, and each dot's
 * diameter is w - floor(w/4). Every edge restarts the chain, so corners get
 * dots from both adjacent edges (the ring clip trims the excess).
 */
function paintDottedEdge(
  canvas: CanvasLike,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  horizontal: boolean,
  color: Color,
): void {
  // Mirrors BoxBorderPainter::DrawLineWithStyle for the straight-edge dotted
  // outline (PaintStraightEdge): the center edge is extended by (width+1)/2 at
  // both ends and rounded, then dots are placed by width — width <= 3 draws
  // width×width butt squares (EnforceDotsAtEndpoints keeps full squares at the
  // corners), width >= 4 draws round-cap circles of diameter = width with the
  // endpoints moved in by width/2. Corners where two edges' first/last dots
  // coincide double-blend, matching Chrome's two DrawLine calls.
  const joint = Math.floor((width + 1) / 2);
  let a = Math.round((horizontal ? Math.min(x0, x1) : Math.min(y0, y1)) - joint);
  let b = Math.round((horizontal ? Math.max(x0, x1) : Math.max(y0, y1)) + joint);
  const cross = horizontal ? Math.min(y0, y1) : Math.min(x0, x1);
  if (width <= 3) {
    const length = b - a;
    const lo = cross - Math.floor(width / 2);
    let useStart = false;
    let startGrowth = 0;
    let startOffset = 0;
    let useEnd = false;
    let endGrowth = 0;
    if (width === 1) {
      if (length % 2 === 0) {
        useStart = true;
        startGrowth = 1;
        startOffset = 1;
      }
    } else if (width === 2) {
      const m = length % 4;
      if (m === 0 || m === 1) {
        useStart = true;
        startOffset = -1;
      }
      if (m === 0) useEnd = true;
      if (m === 3) {
        useStart = true;
        startOffset = 1;
      }
    } else {
      const m = length % 6;
      if (m === 0) {
        useStart = true;
        startGrowth = 1;
        startOffset = 1;
      }
      if (m === 1 || m === 2) {
        useStart = true;
        startOffset = -1;
      }
      if (m === 1) useEnd = true;
      if (m === 4 || m === 5) {
        useStart = true;
        startOffset = 1;
      }
      if (m === 5) useEnd = true;
      else if (m === 0) {
        useEnd = true;
        endGrowth = 1;
      }
    }
    if (useStart) {
      if (horizontal) canvas.fillRect(a, lo, width + startGrowth, width, color);
      else canvas.fillRect(lo, a, width, width + startGrowth, color);
      a += 2 * width + startOffset;
    }
    if (useEnd) {
      if (horizontal) canvas.fillRect(b - width - endGrowth, lo, width + endGrowth, width, color);
      else canvas.fillRect(lo, b - width - endGrowth, width, width + endGrowth, color);
      b -= width + endGrowth + 1;
    }
    for (let d = a; d + width <= b; d += 2 * width) {
      if (horizontal) canvas.fillRect(d, lo, width, width, color);
      else canvas.fillRect(lo, d, width, width, color);
    }
    return;
  }
  const shift = width % 2 ? 0.5 : 0;
  const start = a + width / 2;
  const end = b - width / 2;
  const span = end - start;
  if (span <= 0) return;
  // The [0, 2w] round-cap dash is fitted to the line: round(span/2w) gaps,
  // period = span/gaps, dots at both endpoints (measured: an 89px line gets 11
  // stretched gaps at p=8.09, not 12 compressed ones).
  const gaps = Math.max(1, Math.round(span / (2 * width)));
  const period = span / gaps;
  for (let k = 0; k <= gaps; k++) {
    const c = start + k * period;
    canvas.beginPath();
    if (horizontal) canvas.ellipse(c, cross + shift, width / 2, width / 2, 0, 0, Math.PI * 2, false);
    else canvas.ellipse(cross + shift, c, width / 2, width / 2, 0, 0, Math.PI * 2, false);
    canvas.fillPath(color);
  }
}

/** One outline edge (center-line segment) with its two endpoints. */
interface OutlineEdge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  horizontal: boolean;
  topOrLeft: boolean;
}

function centerEdges(c: Box): OutlineEdge[] {
  return [
    { x0: c.x, y0: c.y, x1: c.x + c.width, y1: c.y, horizontal: true, topOrLeft: true },
    { x0: c.x + c.width, y0: c.y, x1: c.x + c.width, y1: c.y + c.height, horizontal: false, topOrLeft: false },
    { x0: c.x + c.width, y0: c.y + c.height, x1: c.x, y1: c.y + c.height, horizontal: true, topOrLeft: false },
    { x0: c.x, y0: c.y + c.height, x1: c.x, y1: c.y, horizontal: false, topOrLeft: true },
  ];
}

/**
 * The rounded center path walked in Chrome's contour order (starting at the
 * top-left arc start on the left edge, clockwise), as straight segments and
 * quarter arcs so dotted/dashed outlines can place geometry by arc length.
 */
interface CenterSegment {
  kind: 'line' | 'arc';
  length: number;
  // line endpoints
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  // arc parameters (quarter ellipse)
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  a0?: number;
  a1?: number;
}

function roundedCenterSegments(c: Box, radii: ResolvedRadii): CenterSegment[] {
  const { x, y, width: w, height: h } = c;
  const tl = radii.topLeft;
  const tr = radii.topRight;
  const br = radii.bottomRight;
  const bl = radii.bottomLeft;
  const quarter = (rx: number, ry: number): number => {
    if (rx <= 0 || ry <= 0) return 0;
    // Ramanujan's ellipse perimeter, quartered.
    const p = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    return p / 4;
  };
  return [
    { kind: 'arc', length: quarter(tl.rx, tl.ry), cx: x + tl.rx, cy: y + tl.ry, rx: tl.rx, ry: tl.ry, a0: Math.PI, a1: 1.5 * Math.PI },
    { kind: 'line', length: Math.max(0, w - tl.rx - tr.rx), x0: x + tl.rx, y0: y, x1: x + w - tr.rx, y1: y },
    { kind: 'arc', length: quarter(tr.rx, tr.ry), cx: x + w - tr.rx, cy: y + tr.ry, rx: tr.rx, ry: tr.ry, a0: 1.5 * Math.PI, a1: 2 * Math.PI },
    { kind: 'line', length: Math.max(0, h - tr.ry - br.ry), x0: x + w, y0: y + tr.ry, x1: x + w, y1: y + h - br.ry },
    { kind: 'arc', length: quarter(br.rx, br.ry), cx: x + w - br.rx, cy: y + h - br.ry, rx: br.rx, ry: br.ry, a0: 0, a1: 0.5 * Math.PI },
    { kind: 'line', length: Math.max(0, w - br.rx - bl.rx), x0: x + w - br.rx, y0: y + h, x1: x + bl.rx, y1: y + h },
    { kind: 'arc', length: quarter(bl.rx, bl.ry), cx: x + bl.rx, cy: y + h - bl.ry, rx: bl.rx, ry: bl.ry, a0: 0.5 * Math.PI, a1: Math.PI },
    { kind: 'line', length: Math.max(0, h - bl.ry - tl.ry), x0: x, y0: y + h - bl.ry, x1: x, y1: y + tl.ry },
  ];
}

function traceSegment(canvas: CanvasLike, seg: CenterSegment, from: number, to: number): void {
  const f = from / seg.length;
  const g = to / seg.length;
  if (seg.kind === 'line') {
    canvas.moveTo(seg.x0! + (seg.x1! - seg.x0!) * f, seg.y0! + (seg.y1! - seg.y0!) * f);
    canvas.lineTo(seg.x0! + (seg.x1! - seg.x0!) * g, seg.y0! + (seg.y1! - seg.y0!) * g);
    return;
  }
  canvas.moveTo(seg.cx! + seg.rx! * Math.cos(seg.a0! + (seg.a1! - seg.a0!) * f), seg.cy! + seg.ry! * Math.sin(seg.a0! + (seg.a1! - seg.a0!) * f));
  canvas.ellipse(seg.cx!, seg.cy!, seg.rx!, seg.ry!, 0, seg.a0! + (seg.a1! - seg.a0!) * f, seg.a0! + (seg.a1! - seg.a0!) * g, false);
}

function perimeterOf(segments: CenterSegment[]): number {
  return segments.reduce((a, s) => a + s.length, 0);
}

/** Stroke each dash interval of the parameter range [0, len] as its own path.
 * The pattern fits against `fitW` (the outline width); the stroke itself uses
 * `width` (bumped for odd widths). */
function strokeDashedPath(canvas: CanvasLike, segments: CenterSegment[], len: number, width: number, color: Color, fitW: number): void {
  const { period0, dashFrac } = dashPattern(fitW);
  const n = Math.max(1, Math.round(len / period0));
  const dash0 = period0 * dashFrac;
  // The chain runs in pattern space (period0 steps, opening with the gap so
  // the seam never cuts a dash) stretched by n*period0/len onto the contour.
  const stretch = (n * period0) / len;
  for (let k = 0; k < n; k++) {
    const a = (period0 - dash0 + k * period0) / stretch;
    if (a >= len) break;
    const b = Math.min(a + dash0 / stretch, len);
    canvas.beginPath();
    walkSegments(canvas, segments, a, b);
    canvas.strokePath(color, width);
  }
}

/** Trace the path pieces covering arc-length [from, to], across segments. */
function walkSegments(canvas: CanvasLike, segments: CenterSegment[], from: number, to: number): void {
  let pos = 0;
  for (const seg of segments) {
    if (seg.length <= 0) continue;
    const segEnd = pos + seg.length;
    const s0 = Math.max(from, pos);
    const s1 = Math.min(to, segEnd);
    if (s1 > s0) traceSegment(canvas, seg, s0 - pos, s1 - pos);
    pos = segEnd;
    if (pos >= to) break;
  }
}

/** Dots along the rounded center path: the whole contour is stroked with the
 * [0, 2×w] round-cap dash fitted to the closed length — circles of diameter w
 * at arc length k × period, phase 0 at the contour start. */
function paintDottedPath(canvas: CanvasLike, segments: CenterSegment[], len: number, width: number, color: Color): void {
  const r = width / 2;
  const period0 = 2 * width;
  const n = Math.max(1, Math.round(len / period0));
  // Same pattern-space stretch as the dashed chain; the first dot opens half a
  // period in so the seam stays inside a gap.
  const stretch = (n * period0) / len;
  const dotAt = (s: number): void => {
    let pos = 0;
    for (const seg of segments) {
      if (seg.length <= 0) continue;
      if (pos + seg.length > s) {
        const t = (s - pos) / seg.length;
        canvas.beginPath();
        if (seg.kind === 'line') {
          const x = seg.x0! + (seg.x1! - seg.x0!) * t;
          const y = seg.y0! + (seg.y1! - seg.y0!) * t;
          canvas.moveTo(x + r, y);
          canvas.ellipse(x, y, r, r, 0, 0, Math.PI * 2, false);
        } else {
          const a = seg.a0! + (seg.a1! - seg.a0!) * t;
          const x = seg.cx! + seg.rx! * Math.cos(a);
          const y = seg.cy! + seg.ry! * Math.sin(a);
          canvas.moveTo(x + r, y);
          canvas.ellipse(x, y, r, r, 0, 0, Math.PI * 2, false);
        }
        canvas.fillPath(color);
        return;
      }
      pos += seg.length;
    }
  };
  for (let k = 0; k < n; k++) dotAt((period0 / 2 + k * period0) / stretch);
}

/** One four-side color group of the rounded center path, for the two-tone styles. */
function strokeTwoToneGroup(canvas: CanvasLike, segments: CenterSegment[], from: number, to: number, color: Color, width: number): void {
  canvas.beginPath();
  walkSegments(canvas, segments, from, to);
  canvas.strokePath(color, width);
}

/**
 * Paint one outline op: the ring at [offset, offset+width] outside the border
 * box, following the border-radius contour. Style dispatch mirrors Chrome's
 * OutlinePainter: solid fills the ring, double fills the two third-bands, and
 * dotted/dashed stroke the center line (per-edge restarts for square boxes, a
 * continuous fitted stroke along the contour for rounded ones).
 */
function paintOutlineOp(canvas: CanvasLike, op: PaintOp, viewport?: Viewport | null): void {
  const o = op.outline!;
  const box = snapBox(op.box);
  const width = o.width;
  if (width <= 0 || box.width <= 0 || box.height <= 0) return;
  const borderRadii =
    op.borderRadius && hasNonZeroRadius(op.borderRadius)
      ? resolveBorderRadius(op.borderRadius, box.width, box.height, viewport)
      : null;
  const ring = outlineRing(box, borderRadii, o.offset, width);
  const color = o.color;
  canvas.save();
  clipOutlineRing(canvas, ring);
  // Odd widths stroke wider (Chrome bumps to width+2); under the ring clip the
  // band rasterizes fully either way, but the wider stroke keeps corners filled.
  const strokeW = width + (width % 2 === 1 ? 2 : 0);
  switch (o.style) {
    case 'solid':
      canvas.fillRect(ring.outer.x, ring.outer.y, ring.outer.width, ring.outer.height, color);
      break;
    case 'double': {
      const sw = Math.round(width / 3);
      if (sw <= 0) {
        canvas.fillRect(ring.outer.x, ring.outer.y, ring.outer.width, ring.outer.height, color);
        break;
      }
      const bandRect = (depth: number): { rect: Box; radii: ResolvedRadii } => {
        const rect = {
          x: box.x - ring.oH - depth,
          y: box.y - ring.oV - depth,
          width: box.width + 2 * (ring.oH + depth),
          height: box.height + 2 * (ring.oV + depth),
        };
        return {
          rect,
          radii: reduceOverlapRadii(
            expandRadii(borderRadii ?? ZERO_RESOLVED_RADII, Math.max(0, ring.oH + depth)),
            expandRadii(borderRadii ?? ZERO_RESOLVED_RADII, Math.max(0, ring.oV + depth)),
            rect,
          ),
        };
      };
      // Inner third band: fill everything inside the box expanded by
      // offset+sw — the ring clip reduces it to the band adjacent to the box.
      const innerThird = bandRect(sw);
      canvas.beginPath();
      traceBoxPath(canvas, innerThird.rect, innerThird.radii, ring.rounded);
      canvas.fillPath(color);
      // Outer third band: clip out the box expanded by offset+width-sw, then
      // fill the bounds (the evenodd pair with an enclosing rect clips to the
      // region outside the inner rect).
      const outerThird = bandRect(width - sw);
      canvas.beginPath();
      canvas.moveTo(ring.outer.x - 1, ring.outer.y - 1);
      canvas.lineTo(ring.outer.x + ring.outer.width + 1, ring.outer.y - 1);
      canvas.lineTo(ring.outer.x + ring.outer.width + 1, ring.outer.y + ring.outer.height + 1);
      canvas.lineTo(ring.outer.x - 1, ring.outer.y + ring.outer.height + 1);
      canvas.closePath();
      traceBoxPath(canvas, outerThird.rect, outerThird.radii, ring.rounded);
      canvas.clip('evenodd');
      canvas.fillRect(ring.outer.x, ring.outer.y, ring.outer.width, ring.outer.height, color);
      break;
    }
    case 'dashed':
    case 'dotted': {
      if (ring.rounded) {
        const segments = roundedCenterSegments(ring.center, ring.centerRadii);
        const len = perimeterOf(segments);
        if (len <= 0) break;
        if (o.style === 'dashed') strokeDashedPath(canvas, segments, len, strokeW, color, width);
        else paintDottedPath(canvas, segments, len, width, color);
      } else {
        // Straight edges: dash chains anchor at the ring's outer edge; dot
        // chains anchor at the center line (both probed against Chrome).
        const b = box;
        const edges: { outer: number; span: number; band: number; horizontal: boolean }[] = [
          { outer: ring.outer.x, span: b.width, band: ring.outer.y, horizontal: true },
          { outer: ring.outer.y, span: b.height, band: ring.outer.x, horizontal: false },
          { outer: ring.outer.x, span: b.width, band: ring.inner.y + ring.inner.height, horizontal: true },
          { outer: ring.outer.y, span: b.height, band: ring.inner.x + ring.inner.width, horizontal: false },
        ];
        const centerEdgesList = centerEdges(ring.center);
        let side = 0;
        for (const e of edges) {
          if (o.style === 'dashed') {
            paintDashedEdge(canvas, e.outer, e.span, e.band, width, e.horizontal, color, width);
          } else {
            const ce = centerEdgesList[side];
            paintDottedEdge(canvas, ce.x0, ce.y0, ce.x1, ce.y1, width, ce.horizontal, color);
          }
          side++;
        }
      }
      break;
    }
    case 'inset':
    case 'outset':
    case 'groove':
    case 'ridge': {
      const dark = colorDark(color);
      const topLeftColor = o.style === 'inset' || o.style === 'groove' ? dark : color;
      const bottomRightColor = o.style === 'inset' || o.style === 'groove' ? color : dark;
      if (ring.rounded) {
        const segments = roundedCenterSegments(ring.center, ring.centerRadii);
        const strokeGroups = (topLeft: Color, bottomRight: Color): void => {
          // Group each straight side with the corner arc that follows it.
          let pos = 0;
          const bounds: number[] = [];
          for (const s of segments) {
            pos += s.length;
            bounds.push(pos);
          }
          const seg = (i: number): [number, number] => [i === 0 ? 0 : bounds[i - 1], bounds[i]];
          const groups: [number, Color][] = [
            [0, topLeft],
            [1, topLeft],
            [2, topLeft],
            [3, bottomRight],
            [4, bottomRight],
            [5, bottomRight],
            [6, bottomRight],
            [7, topLeft],
          ];
          for (const [i, c] of groups) {
            const [a, b] = seg(i);
            if (b <= a) continue;
            strokeTwoToneGroup(canvas, segments, a, b, c, strokeW);
          }
        };
        strokeGroups(topLeftColor, bottomRightColor);
        if (o.style === 'groove' || o.style === 'ridge') {
          canvas.save();
          canvas.beginPath();
          traceBoxPath(canvas, ring.center, ring.centerRadii, true);
          canvas.clip();
          const innerTopLeft = o.style === 'groove' ? color : dark;
          const innerBottomRight = o.style === 'groove' ? dark : color;
          strokeGroups(innerTopLeft, innerBottomRight);
          canvas.restore();
        }
      } else {
        const edges = centerEdges(ring.center);
        for (const e of edges) paintDashedEdgeQuads(canvas, e, strokeW, e.topOrLeft ? topLeftColor : bottomRightColor);
        if (o.style === 'groove' || o.style === 'ridge') {
          canvas.save();
          canvas.beginPath();
          canvas.moveTo(ring.center.x, ring.center.y);
          canvas.lineTo(ring.center.x + ring.center.width, ring.center.y);
          canvas.lineTo(ring.center.x + ring.center.width, ring.center.y + ring.center.height);
          canvas.lineTo(ring.center.x, ring.center.y + ring.center.height);
          canvas.closePath();
          canvas.clip();
          const innerTopLeft = o.style === 'groove' ? color : dark;
          const innerBottomRight = o.style === 'groove' ? dark : color;
          for (const e of edges) paintDashedEdgeQuads(canvas, e, strokeW, e.topOrLeft ? innerTopLeft : innerBottomRight);
          canvas.restore();
        }
      }
      break;
    }
    default:
      break;
  }
  canvas.restore();
}

/** Full-width band quads per edge (the solid two-tone strokes for inset etc.). */
function paintDashedEdgeQuads(canvas: CanvasLike, e: OutlineEdge, thickness: number, color: Color): void {
  const half = thickness / 2;
  if (e.horizontal) {
    canvas.fillRect(Math.min(e.x0, e.x1), Math.min(e.y0, e.y1) - half, Math.abs(e.x1 - e.x0), thickness, color);
  } else {
    canvas.fillRect(Math.min(e.x0, e.x1) - half, Math.min(e.y0, e.y1), thickness, Math.abs(e.y1 - e.y0), color);
  }
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
    paintBackgroundOp(canvas, op, viewport);
  } else if (op.kind === 'border') {
    if (op.borderRadius && hasNonZeroRadius(op.borderRadius)) {
      paintRoundedBorder(canvas, op, viewport);
    } else {
      const styles = op.borderStyles ?? { top: 'solid' as const, right: 'solid' as const, bottom: 'solid' as const, left: 'solid' as const };
      paintBorder(canvas, op.box, op.borderWidths!, op.borderColors!, styles);
    }
  } else if (op.kind === 'shadow') {
    paintShadow(canvas, op, viewport);
  } else if (op.kind === 'outline') {
    paintOutlineOp(canvas, op, viewport);
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
