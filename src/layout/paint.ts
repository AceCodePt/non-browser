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
import { hasNonZeroRadius, innerRadii, resolveBorderRadius, traceRoundedRect, type RoundedClip, type ResolvedRadii } from './radius.js';
import type { PaintOp, RootLayout, TextDecorationPaint, ListMarker } from './block-inline.js';
import type { Box } from '../harness/fixtures.js';
import { cssFontString, measureTextWidth } from './measure.js';
import { fontVerticalMetrics, lineAscentContribution, roundedAscent, roundedDescent, type FontVerticalMetrics } from './fontmetrics.js';

type SideWidths = Record<Side, number>;
type SideColors = Record<Side, Color>;

export interface RenderOutput {
  width: number;
  height: number;
  /** RGBA pixel buffer. */
  rgba: Buffer;
  /** getBoundingClientRect per element id (border boxes). */
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
}

/** Draw one layout line's text, applying letter-spacing when non-zero. */
function paintTextRun(
  canvas: { drawText(text: string, x: number, baseline: number, font: string, color: Color): void },
  run: { text: string; x: number; baseline: number; fontWeight?: number; fontStyle?: 'normal' | 'italic' },
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
  // Draw glyph-by-glyph, positioning each character at its shaped prefix
  // advance (kerning preserved) plus the accumulated letter-spacing. The
  // trailing letter-spacing after the last character is accounted for in the
  // run's layout width (decorations) but paints nothing here.
  const chars = Array.from(run.text);
  let prefix = '';
  for (let i = 0; i < chars.length; i++) {
    const x = run.x + measureTextWidth(prefix, fontSize, family, 0, run.fontWeight, run.fontStyle) + i * letterSpacing;
    canvas.drawText(chars[i], x, run.baseline, font, color);
    prefix += chars[i];
  }
}

/** Vertical content metrics Blink derives from the font (rounded to int). */
function contentMetrics(fontSize: number, vm: FontVerticalMetrics): { ascent: number; descent: number; contentHeight: number } {
  const ascent = Math.round((vm.ascent / vm.unitsPerEm) * fontSize);
  const descent = Math.round((vm.descent / vm.unitsPerEm) * fontSize);
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

/** The per-edge color for an inset/outset border, given the base border color. */
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

function paintBorder(
  canvas: { fillRect(x: number, y: number, w: number, h: number, color: Color): void },
  box: Box,
  widths: SideWidths,
  colors: SideColors,
  styles: Record<Side, BorderStyle>,
): void {
  const { x, y, width, height } = box;
  const sides: { side: Side; rect: Box }[] = [
    { side: 'top', rect: { x, y, width, height: widths.top } },
    { side: 'right', rect: { x: x + width - widths.right, y, width: widths.right, height } },
    { side: 'bottom', rect: { x, y: y + height - widths.bottom, width, height: widths.bottom } },
    { side: 'left', rect: { x, y, width: widths.left, height } },
  ];
  for (const s of sides) {
    if (widths[s.side] <= 0) continue;
    canvas.fillRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height, insetEdgeColor(styles[s.side] ?? 'solid', s.side, colors[s.side]));
  }
}

/** True when any resolved radius is non-zero (a plain rect otherwise). */
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

/** Paint one list marker: a 5px disc/circle/square or the decimal counter text. */
function paintListMarker(canvas: CanvasLike, op: PaintOp): void {
  const m = op.marker!;
  if (m.kind === 'disc') {
    const r = 2.5;
    canvas.beginPath();
    canvas.moveTo(m.centerX + r, m.centerY);
    canvas.ellipse(m.centerX, m.centerY, r, r, 0, 0, Math.PI * 2, false);
    canvas.fillPath(m.color);
  } else if (m.kind === 'circle') {
    const r = 2.5;
    canvas.beginPath();
    canvas.moveTo(m.centerX + r, m.centerY);
    canvas.ellipse(m.centerX, m.centerY, r, r, 0, 0, Math.PI * 2, false);
    canvas.moveTo(m.centerX + 1.5, m.centerY);
    canvas.ellipse(m.centerX, m.centerY, 1.5, 1.5, 0, 0, Math.PI * 2, false);
    canvas.fillPath(m.color, 'evenodd');
  } else if (m.kind === 'square') {
    canvas.fillRect(m.centerX - 2.5, m.centerY - 2.5, 5, 5, m.color);
  } else if (m.kind === 'decimal' && m.text !== undefined && m.baseline !== undefined && m.rightX !== undefined) {
    const width = measureTextWidth(m.text, m.fontSize, m.family);
    canvas.drawText(m.text, m.rightX - width, m.baseline, cssFontString(m.fontSize, m.family), m.color);
  }
}

/**
 * Paint a rounded solid border as the region between the outer border-box
 * rounded rect and the inner padding-box rounded rect (outer radii minus the
 * border widths). With a uniform border color the whole ring fills once; with
 * differing side colors each side fills its band clipped to the ring.
 */
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

/** Clip to a rounded overflow clip rect (border box + its radii). */
function applyRoundedClip(canvas: CanvasLike, clip: RoundedClip, viewport?: Viewport | null): void {
  const radii = resolveBorderRadius(clip.radii, clip.width, clip.height, viewport);
  traceRoundedRect(canvas, clip.x, clip.y, clip.width, clip.height, radii);
  canvas.clip();
}

/**
 * Paint the layout through a CanvasFactory and produce the pixel buffer +
 * per-id rects.
 */
export function paint(
  root: RootLayout,
  viewportWidth: number,
  viewportHeight: number,
  ids: string[],
  fontFile?: string,
  factory: CanvasFactory = skiaCanvasFactory,
  viewport?: Viewport | null,
  textElements?: string[],
): RenderOutput {
  const canvas = factory.create(viewportWidth, viewportHeight);
  canvas.fillRect(0, 0, viewportWidth, viewportHeight, { r: 255, g: 255, b: 255, a: 1 });

  const fontMetrics = fontFile ? fontVerticalMetrics(fontFile) : null;

  for (const op of root.paints) {
    const clipped = op.clip != null;
    if (clipped) {
      canvas.save();
      canvas.beginPath();
      applyRoundedClip(canvas, op.clip!, viewport);
    }
    if (op.kind === 'bg') {
      if (op.borderRadius && hasNonZeroRadius(op.borderRadius)) {
        paintRoundedBackground(canvas, op, viewport);
      } else {
        canvas.fillRect(op.box.x, op.box.y, op.box.width, op.box.height, op.color!);
      }
    } else if (op.kind === 'border') {
      if (op.borderRadius && hasNonZeroRadius(op.borderRadius)) {
        paintRoundedBorder(canvas, op, viewport);
      } else {
        const styles = op.borderStyles ?? { top: 'solid' as const, right: 'solid' as const, bottom: 'solid' as const, left: 'solid' as const };
        paintBorder(canvas, op.box, op.borderWidths!, op.borderColors!, styles);
      }
    } else if (op.kind === 'text') {
      const t = op.text!;
      for (const run of t.runs) {
        const fontSize = run.fontSize ?? t.fontSize;
        const family = run.family ?? t.family;
        const color = run.color ?? t.color;
        const letterSpacing = run.letterSpacing ?? t.letterSpacing;
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

  const rects: Record<string, Box> = {};
  collectRects(root, rects);
  const generatedTextRects: Box[] = [];
  collectGeneratedTextRects(root, generatedTextRects);
  const textFragments: Record<string, Box[]> = {};
  if (textElements && textElements.length > 0) collectTextFragments(root, textElements, textFragments, fontMetrics);
  const missing: string[] = [];
  for (const id of ids) if (!rects[id]) missing.push(id);
  if (missing.length > 0) {
    throw new Error(`layout: no rect collected for id(s): ${missing.join(', ')}`);
  }
  return {
    width: viewportWidth,
    height: viewportHeight,
    rgba: canvas.toBuffer(),
    rects,
    generatedTextRects,
    textFragments,
  };
}

function rectFor(node: RootLayout['root']): Box {
  return { x: node.borderX, y: node.borderY, width: node.borderWidth, height: node.borderHeight };
}

function idOf(el: RootLayout['root']['element']): string | null {
  if (!el) return null;
  const a = el.attrs.find((x) => x.name === 'id');
  return a ? a.value : null;
}

function collectRects(root: RootLayout, out: Record<string, Box>): void {
  const walk = (node: RootLayout['root']): void => {
    const id = idOf(node.element);
    if (id && !out[id]) out[id] = rectFor(node);
    for (const child of node.children) walk(child);
  };
  walk(root.root);
  for (const f of root.floats.floats) {
    const id = idOf(f.element);
    if (id && !out[id]) out[id] = { x: f.borderX, y: f.borderY, width: f.borderWidth, height: f.borderHeight };
  }
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
