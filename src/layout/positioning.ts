/**
 * Positioned layout (CSS 2.1 §9.6, §10.3.7, §10.6.4): relative offsets,
 * absolute/fixed containing-block resolution, static-position fallback, and
 * auto-margin centering. Static rendering, so fixed boxes resolve against the
 * viewport input (the initial containing block).
 *
 * The engine lays out absolutely/fixed positioned children in a deferred pass
 * (Blink's `layoutPositionedObjects`): an out-of-flow child is recorded with
 * its static position during the in-flow pass, and laid out once its
 * containing block's height is known. block-inline.ts owns that plumbing; this
 * module owns the geometry: the §10.3.7/§10.6.4 offset equations and the
 * shrink-to-fit width used when `width: auto`.
 */

import { collectInlineText, layoutElementBox, type LayoutNode, type PaintOp } from './block-inline.js';
import { borderPaddingBlock, borderPaddingInline, resolveLength, type ComputedStyle, type Length, type Viewport } from './css.js';
import type { Box } from './types.js';
import { measureTextWidth } from './measure.js';
import { getActiveBrowserConfig } from '../config/browser-config.js';
import { FloatManager } from './floats.js';
import type { P5Element } from './types.js';

export interface PendingAbs {
  el: P5Element;
  style: ComputedStyle;
  staticX: number;
  staticY: number;
  /** the width of the block formatting context that produced the static
   * position — under an RTL containing block the static box sits flush right,
   * so the offset equation needs the static box's inline-end edge. */
  staticWidth: number;
  fixed: boolean;
}

export interface ContainingBlock {
  rect: Box;
  heightKnown: boolean;
  pending: PendingAbs[];
  /** the containing block's computed direction (CSS 2.1 §10.3.7 resolves
   * over-constrained offsets against the containing block's direction). */
  direction: 'ltr' | 'rtl';
}

export function initialContainingBlock(viewport: Viewport): Box {
  return { x: 0, y: 0, width: viewport.width, height: viewport.height };
}

function resolve(l: Length, ref: number, viewport?: Viewport | null): number | null {
  return resolveLength(l, ref, viewport ?? null);
}

// ===== §10.3.7 horizontal offset equation =====

export interface AbsHorizontalInput {
  cbWidth: number;
  cbX: number;
  staticLeft: number;
  /** the static box's inline-end edge (right) under an RTL containing block —
   * both offsets auto then pin the box's right edge there (§10.3.3). */
  staticRight?: number;
  left: number | null;
  right: number | null;
  width: number | null;
  marginLeft: number | null;
  marginRight: number | null;
  borderPadH: number;
  shrinkFit: (avail: number) => number;
  /** the containing block's computed direction — an over-constrained box
   * ignores the inline-end offset (right under ltr, left under rtl, CSS 2.1
   * §10.3.7). */
  direction?: 'ltr' | 'rtl';
}

export interface AbsHorizontalOutput {
  x: number;
  width: number;
  marginLeft: number;
  marginRight: number;
}

export function solveAbsHorizontal(inp: AbsHorizontalInput): AbsHorizontalOutput {
  const { cbWidth: W, cbX, staticLeft, borderPadH, shrinkFit } = inp;
  const rtl = inp.direction === 'rtl';
  let left = inp.left;
  let right = inp.right;
  let width = inp.width;
  let mL = inp.marginLeft;
  let mR = inp.marginRight;

  // Resolve width first: with both offsets set it stretches; otherwise it is
  // shrink-to-fit.
  if (width === null) {
    if (left !== null && right !== null) {
      width = Math.max(0, W - left - right - (mL ?? 0) - (mR ?? 0) - borderPadH);
    } else {
      const avail = Math.max(0, W - (left ?? 0) - (right ?? 0) - (mL ?? 0) - (mR ?? 0) - borderPadH);
      width = shrinkFit(avail);
    }
  }

  if (left !== null && right !== null) {
    if (mL === null && mR === null) {
      const free = W - left - right - width - borderPadH;
      mL = mR = free / 2;
    } else if (mL === null) {
      mL = W - left - right - width - (mR ?? 0) - borderPadH;
    } else if (mR === null) {
      mR = W - left - right - width - mL - borderPadH;
    } else {
      // Over-constrained: ignore the inline-end offset (right under ltr, left
      // under rtl) per CSS 2.1 §10.3.7.
      if (rtl) left = W - right - width - mL - mR - borderPadH;
      else right = W - left - width - mL - mR - borderPadH;
    }
  } else {
    if (left === null && right === null) {
      // Both offsets auto: the box lands at its static position. Under an RTL
      // containing block that pins the box's inline-end (right) edge to the
      // static BFC's inline-end edge (CSS 2.1 §10.3.3), so the box mirrors
      // from the static right edge instead of taking a left static position.
      if (rtl && inp.staticRight !== undefined) left = inp.staticRight - width - (mL ?? 0) - (mR ?? 0) - borderPadH;
      else left = staticLeft;
    }
    const mL0 = mL ?? 0;
    const mR0 = mR ?? 0;
    if (right === null) {
      // `left` is non-null here: either it was set, or both were auto and left
      // just took the static position.
      right = W - left! - width - mL0 - mR0 - borderPadH;
    } else {
      left = W - right - width - mL0 - mR0 - borderPadH;
    }
  }

  return { x: cbX + left! + (mL ?? 0), width, marginLeft: mL ?? 0, marginRight: mR ?? 0 };
}

// ===== §10.6.4 vertical offset equation =====

export interface AbsVerticalInput {
  cbHeight: number;
  cbY: number;
  staticTop: number;
  top: number | null;
  bottom: number | null;
  height: number | null;
  marginTop: number | null;
  marginBottom: number | null;
  borderPadV: number;
  contentHeight: number;
}

export interface AbsVerticalOutput {
  y: number;
  height: number;
  marginTop: number;
  marginBottom: number;
}

export function solveAbsVertical(inp: AbsVerticalInput): AbsVerticalOutput {
  const { cbHeight: H, cbY, staticTop, borderPadV, contentHeight } = inp;
  let top = inp.top;
  let bottom = inp.bottom;
  let height = inp.height;
  let mT = inp.marginTop;
  let mB = inp.marginBottom;

  if (height === null) {
    if (top !== null && bottom !== null) {
      height = Math.max(0, H - top - bottom - (mT ?? 0) - (mB ?? 0) - borderPadV);
    } else {
      // Content height (out-of-flow children do not contribute).
      height = contentHeight;
    }
  }

  if (top !== null && bottom !== null) {
    if (mT === null && mB === null) {
      const free = H - top - bottom - height - borderPadV;
      mT = mB = free / 2;
    } else if (mT === null) {
      mT = H - top - bottom - height - (mB ?? 0) - borderPadV;
    } else if (mB === null) {
      mB = H - top - bottom - height - mT - borderPadV;
    } else {
      // Over-constrained: ignore bottom.
      bottom = H - top - height - mT - mB - borderPadV;
    }
  } else {
    if (top === null && bottom === null) top = staticTop;
    const mT0 = mT ?? 0;
    const mB0 = mB ?? 0;
    if (bottom === null) {
      // `top` is non-null here: either it was set, or both were auto and top
      // just took the static position.
      bottom = H - top! - height - mT0 - mB0 - borderPadV;
    } else {
      top = H - bottom - height - mT0 - mB0 - borderPadV;
    }
  }

  return { y: cbY + top! + (mT ?? 0), height, marginTop: mT ?? 0, marginBottom: mB ?? 0 };
}

function maxContentOf(el: P5Element, styles: Map<P5Element, ComputedStyle>, refWidth: number): { max: number; min: number } {
  let max = 0;
  let min = 0;
  const text = collectInlineText(el, styles).trim();
  if (text) {
    const fontSize = styles.get(el)?.fontSize ?? 16;
    const family = styles.get(el)?.fontFamily ?? getActiveBrowserConfig().defaultFamily;
    const ls = styles.get(el)?.letterSpacing ?? 0;
    max = measureTextWidth(text, fontSize, family, ls);
    min = Math.max(0, ...text.split(/\s+/).map((w) => measureTextWidth(w, fontSize, family, ls)));
  }
  for (const child of el.childNodes) {
    if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
    const cs = styles.get(child as P5Element);
    if (!cs || cs.display === 'none') continue;
    const w = resolve(cs.width, refWidth);
    if (w !== null) {
      max = Math.max(max, w);
      min = Math.max(min, w);
    } else {
      const sub = maxContentOf(child as P5Element, styles, refWidth);
      max = Math.max(max, sub.max);
      min = Math.max(min, sub.min);
    }
  }
  return { max, min };
}

export function absShrinkFitWidth(
  el: P5Element,
  styles: Map<P5Element, ComputedStyle>,
  refWidth: number,
  avail: number,
): number {
  const { max, min } = maxContentOf(el, styles, refWidth);
  return Math.min(Math.max(min, avail), max);
}

export function layoutPositionedChild(
  el: P5Element,
  style: ComputedStyle,
  cb: Box,
  staticLeft: number,
  staticTop: number,
  staticWidth: number,
  styles: Map<P5Element, ComputedStyle>,
  paints: PaintOp[],
  nextOrder: () => number,
  viewport?: Viewport,
  /** the containing block's computed direction (CSS 2.1 §10.3.7). */
  cbDirection: 'ltr' | 'rtl' = 'ltr',
): LayoutNode {
  const cbW = cb.width;
  const cbH = cb.height;

  const mL = resolve(style.margin.left, cbW, viewport);
  const mR = resolve(style.margin.right, cbW, viewport);
  const mT = resolve(style.margin.top, cbW, viewport);
  const mB = resolve(style.margin.bottom, cbW, viewport);
  const borderPadH = borderPaddingInline(style, cbW, viewport);
  const borderPadV = borderPaddingBlock(style, cbW, viewport);
  const bL = style.borderWidth.left;
  const bT = style.borderWidth.top;
  const pL = resolve(style.padding.left, cbW, viewport) ?? 0;
  const pT = resolve(style.padding.top, cbW, viewport) ?? 0;

  // Static positions are absolute; the offset equations work in containing
  // block coordinates, so rebase them. Under an RTL containing block both
  // offsets auto put the box at the inline-start (right) static position,
  // like a static box in normal flow would sit (§10.3.3) — the offset equation
  // mirrors the static box against the static BFC's inline-end edge.
  const staticLeftRel = staticLeft - cb.x;
  const staticTopRel = staticTop - cb.y;
  const rtl = cbDirection === 'rtl';
  const bothAuto = resolve(style.left, cbW, viewport) === null && resolve(style.right, cbW, viewport) === null;

  const horiz = solveAbsHorizontal({
    cbWidth: cbW,
    cbX: cb.x,
    staticLeft: staticLeftRel,
    staticRight: rtl && bothAuto ? staticLeftRel + staticWidth : undefined,
    left: resolve(style.left, cbW, viewport),
    right: resolve(style.right, cbW, viewport),
    width: resolve(style.width, cbW, viewport),
    marginLeft: mL,
    marginRight: mR,
    borderPadH,
    shrinkFit: (avail) => absShrinkFitWidth(el, styles, cbW, avail),
    direction: cbDirection,
  });

  // The equation's `width` term is the content-box width.
  const contentWidth = Math.max(0, horiz.width);
  const borderBoxWidth = horiz.width + borderPadH;

  const specH = resolve(style.height, cbH, viewport);
  const specTop = resolve(style.top, cbH, viewport);
  const specBottom = resolve(style.bottom, cbH, viewport);
  const vert = solveAbsVertical({
    cbHeight: cbH,
    cbY: cb.y,
    staticTop: staticTopRel,
    top: specTop,
    bottom: specBottom,
    height: specH,
    marginTop: mT,
    marginBottom: mB,
    borderPadV,
    contentHeight: 0,
  });

  // The vertical solver's y depends only on offsets/margins; the box height is
  // explicit, stretched (top+bottom set), or content-based (no forced height).
  const forcedHeight =
    specH !== null
      ? style.boxSizing === 'border-box'
        ? specH
        : specH + borderPadV
      : specTop !== null && specBottom !== null
        ? Math.max(0, cbH - specTop - specBottom - vert.marginTop - vert.marginBottom)
        : undefined;

  const fm = new FloatManager(horiz.x + bL + pL, contentWidth);
  const node = layoutElementBox(
    el,
    style,
    fm,
    horiz.x,
    vert.y,
    borderBoxWidth,
    horiz.x + bL + pL,
    vert.y + bT + pT,
    contentWidth,
    styles,
    paints,
    nextOrder,
    viewport,
    forcedHeight,
  );
  node.marginTop = vert.marginTop;
  node.marginBottom = vert.marginBottom;
  return node;
}
