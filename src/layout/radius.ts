/**
 * Resolve border-radius lengths into paint-ready numbers and trace rounded
 * rectangle paths on the generic Canvas interface.
 *
 * Resolution follows CSS Backgrounds §4.3: percentages resolve against the
 * border box dimension (rx against width, ry against height), negative radii
 * clamp to 0, and when the sum of two adjacent corner radii exceeds the box
 * size the used radii are scaled down by f = min(Li/Si) over the four sides.
 * The inner (padding-edge) radii used for borders subtract the border widths
 * from the outer radii and repeat the reduction against the padding box.
 */

import type { CanvasLike } from '../canvas/interface.js';
import type { BorderRadius, Length, Viewport } from './css.js';
import { resolveLength } from './css.js';

export interface ResolvedCorner {
  rx: number;
  ry: number;
}

export interface ResolvedRadii {
  topLeft: ResolvedCorner;
  topRight: ResolvedCorner;
  bottomRight: ResolvedCorner;
  bottomLeft: ResolvedCorner;
}

export interface SideWidths {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_RESOLVED_RADII: ResolvedRadii = {
  topLeft: { rx: 0, ry: 0 },
  topRight: { rx: 0, ry: 0 },
  bottomRight: { rx: 0, ry: 0 },
  bottomLeft: { rx: 0, ry: 0 },
};

export interface RoundedClip {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: BorderRadius;
}

export function hasNonZeroRadius(br: BorderRadius): boolean {
  const corners = [br.topLeft, br.topRight, br.bottomRight, br.bottomLeft];
  return corners.some((c) => !isZeroRadiusLength(c.rx) || !isZeroRadiusLength(c.ry));
}

function isZeroRadiusLength(l: Length): boolean {
  if (l.auto) return true;
  if (l.px !== null) return l.px === 0;
  if (l.pct !== null) return l.pct === 0;
  return false;
}

/**
 * Apply the §4.3 overlapping-curves reduction to a resolved radii set.
 * f = min(1, Si/Li) over the four sides (side length over the sum of the two
 * adjacent corner radii on that side); when a sum exceeds the side, f < 1 and
 * every radius is scaled by f.
 */
function reduceOverlap(radii: ResolvedRadii, width: number, height: number): ResolvedRadii {
  const ratios = [
    width / (radii.topLeft.rx + radii.topRight.rx),
    height / (radii.topRight.ry + radii.bottomRight.ry),
    width / (radii.bottomRight.rx + radii.bottomLeft.rx),
    height / (radii.bottomLeft.ry + radii.topLeft.ry),
  ];
  let f = 1;
  for (const r of ratios) {
    if (Number.isFinite(r) && r < f) f = r;
  }
  if (f >= 1) return radii;
  const scale = (c: ResolvedCorner): ResolvedCorner => ({ rx: c.rx * f, ry: c.ry * f });
  return {
    topLeft: scale(radii.topLeft),
    topRight: scale(radii.topRight),
    bottomRight: scale(radii.bottomRight),
    bottomLeft: scale(radii.bottomLeft),
  };
}

export function resolveBorderRadius(
  br: BorderRadius,
  width: number,
  height: number,
  viewport?: Viewport | null,
): ResolvedRadii {
  const corner = (rx: Length, ry: Length): ResolvedCorner => ({
    rx: Math.max(0, resolveLength(rx, width, viewport) ?? 0),
    ry: Math.max(0, resolveLength(ry, height, viewport) ?? 0),
  });
  const radii: ResolvedRadii = {
    topLeft: corner(br.topLeft.rx, br.topLeft.ry),
    topRight: corner(br.topRight.rx, br.topRight.ry),
    bottomRight: corner(br.bottomRight.rx, br.bottomRight.ry),
    bottomLeft: corner(br.bottomLeft.rx, br.bottomLeft.ry),
  };
  if (width <= 0 || height <= 0) return radii;
  return reduceOverlap(radii, width, height);
}

export function innerRadii(
  outer: ResolvedRadii,
  widths: SideWidths,
  boxWidth: number,
  boxHeight: number,
): ResolvedRadii {
  const padW = Math.max(0, boxWidth - widths.left - widths.right);
  const padH = Math.max(0, boxHeight - widths.top - widths.bottom);
  const radii: ResolvedRadii = {
    topLeft: { rx: Math.max(0, outer.topLeft.rx - widths.left), ry: Math.max(0, outer.topLeft.ry - widths.top) },
    topRight: { rx: Math.max(0, outer.topRight.rx - widths.right), ry: Math.max(0, outer.topRight.ry - widths.top) },
    bottomRight: { rx: Math.max(0, outer.bottomRight.rx - widths.right), ry: Math.max(0, outer.bottomRight.ry - widths.bottom) },
    bottomLeft: { rx: Math.max(0, outer.bottomLeft.rx - widths.left), ry: Math.max(0, outer.bottomLeft.ry - widths.bottom) },
  };
  if (padW <= 0 || padH <= 0) return radii;
  return reduceOverlap(radii, padW, padH);
}

/**
 * Add a rounded rectangle as a new subpath on the current path, starting at
 * the top edge and walking the corners counterclockwise with true elliptical
 * arcs (quadrant-by-quadrant). Zero radii collapse to straight corners. The
 * caller owns `beginPath()`: appending several rounded rects to one path
 * (e.g. the even-odd border ring) requires them to share a single path.
 */
export function traceRoundedRect(
  canvas: CanvasLike,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: ResolvedRadii,
): void {
  const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = radii;
  canvas.moveTo(x + tl.rx, y);
  canvas.lineTo(x + width - tr.rx, y);
  canvas.ellipse(x + width - tr.rx, y + tr.ry, tr.rx, tr.ry, 0, -Math.PI / 2, 0);
  canvas.lineTo(x + width, y + height - br.ry);
  canvas.ellipse(x + width - br.rx, y + height - br.ry, br.rx, br.ry, 0, 0, Math.PI / 2);
  canvas.lineTo(x + bl.rx, y + height);
  canvas.ellipse(x + bl.rx, y + height - bl.ry, bl.rx, bl.ry, 0, Math.PI / 2, Math.PI);
  canvas.lineTo(x, y + tl.ry);
  canvas.ellipse(x + tl.rx, y + tl.ry, tl.rx, tl.ry, 0, Math.PI, (3 * Math.PI) / 2);
  canvas.closePath();
}
