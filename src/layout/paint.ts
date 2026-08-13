/**
 * Paint a laid-out tree onto @napi-rs/canvas and collect getBoundingClientRect
 * values for every element with an `id`.
 *
 * Painting order follows CSS: in-flow block backgrounds/borders first, then
 * floats, then inline content (text) on top. Each element's background is
 * clipped to its border box.
 */

import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import type { Color } from './css.js';
import type { PaintOp, RootLayout } from './block-inline.js';
import type { Box } from '../harness/fixtures.js';

type SideWidths = Record<'top' | 'right' | 'bottom' | 'left', number>;
type SideColors = Record<'top' | 'right' | 'bottom' | 'left', Color>;

export interface RenderOutput {
  width: number;
  height: number;
  /** RGBA pixel buffer. */
  rgba: Buffer;
  /** getBoundingClientRect per element id (border boxes). */
  rects: Record<string, Box>;
}

function cssColor(c: Color): string {
  if (c.a === 0) return 'rgba(0,0,0,0)';
  if (c.a >= 1) return `rgb(${c.r},${c.g},${c.b})`;
  return `rgba(${c.r},${c.g},${c.b},${c.a})`;
}

function paintBorder(
  ctx: SKRSContext2D,
  box: Box,
  widths: SideWidths,
  colors: SideColors,
): void {
  const { x, y, width, height } = box;
  const sides: { side: 'top' | 'right' | 'bottom' | 'left'; rect: Box }[] = [
    { side: 'top', rect: { x, y, width, height: widths.top } },
    { side: 'right', rect: { x: x + width - widths.right, y, width: widths.right, height } },
    { side: 'bottom', rect: { x, y: y + height - widths.bottom, width, height: widths.bottom } },
    { side: 'left', rect: { x, y, width: widths.left, height } },
  ];
  for (const s of sides) {
    if (widths[s.side] <= 0) continue;
    ctx.fillStyle = cssColor(colors[s.side]);
    ctx.fillRect(s.rect.x, s.rect.y, s.rect.width, s.rect.height);
  }
}

/** Paint the layout and produce the pixel buffer + per-id rects. */
export function paint(
  root: RootLayout,
  viewportWidth: number,
  viewportHeight: number,
  ids: string[],
): RenderOutput {
  const canvas = createCanvas(viewportWidth, viewportHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  ctx.textBaseline = 'alphabetic';

  for (const op of root.paints) {
    if (op.kind === 'bg') {
      ctx.fillStyle = cssColor(op.color!);
      ctx.fillRect(op.box.x, op.box.y, op.box.width, op.box.height);
    } else if (op.kind === 'border') {
      paintBorder(ctx, op.box, op.borderWidths!, op.borderColors!);
    } else if (op.kind === 'text') {
      const t = op.text!;
      ctx.fillStyle = cssColor(t.color);
      ctx.font = `${t.fontSize}px '${t.family}'`;
      for (const run of t.runs) {
        ctx.fillText(run.text, run.x, run.baseline);
      }
    }
  }

  const rects: Record<string, Box> = {};
  collectRects(root, rects);
  const missing: string[] = [];
  for (const id of ids) if (!rects[id]) missing.push(id);
  if (missing.length > 0) {
    throw new Error(`layout: no rect collected for id(s): ${missing.join(', ')}`);
  }
  return {
    width: viewportWidth,
    height: viewportHeight,
    rgba: canvas.toBuffer('image/png'),
    rects,
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
