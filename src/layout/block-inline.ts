/**
 * Block formatting context and inline (line box) layout — the engine the float
 * machinery plugs into. Floats themselves live in floats.ts; here they enter
 * only through the `FormattingContext` interface:
 *
 *   - `floatIntrusion(top, bottom)` shortens line boxes (text wraps around
 *     floats), and
 *   - `lowestFloatBottom(side)` feeds clearance computation.
 *
 * The box model (CSS 2.1 §8), block stacking + vertical margin collapsing
 * (§9.4.1, §8.3.1), and line-box layout (§9.4.2) are implemented here; float
 * placement is delegated to the context. This module must stay float-agnostic:
 * swap in a different FormattingContext and the same block/inline layout runs.
 */

import { parseStyleAttribute, resolveLength, makeStyle, type ComputedStyle, type Color } from './css.js';
import { layoutTextLines, measureTextWidth, type LineBox } from './measure.js';
import { FloatManager, type FormattingContext } from './floats.js';
import { layoutGridChildren } from './grid.js';
import type { P5Element, P5Text } from './types.js';
import type { Box } from '../harness/fixtures.js';

export { FloatManager };
export type { FormattingContext };

export interface StyleDefaults {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: Color;
}

export function resolveStyles(root: P5Element, defaults: StyleDefaults): Map<P5Element, ComputedStyle> {
  const map = new Map<P5Element, ComputedStyle>();
  const walk = (el: P5Element, d: StyleDefaults): void => {
    const style = makeStyle(
      parseStyleAttribute(el.attrs.find((a) => a.name === 'style')?.value),
      { ...d, display: 'block' },
    );
    map.set(el, style);
    const childDefaults: StyleDefaults = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      color: style.color,
    };
    for (const child of el.childNodes) {
      if (child.nodeName !== '#text') walk(child as P5Element, childDefaults);
    }
  };
  walk(root, defaults);
  return map;
}

export interface LayoutNode {
  element: P5Element | null;
  style: ComputedStyle;
  borderX: number;
  borderY: number;
  borderWidth: number;
  borderHeight: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
  isFloat: boolean;
  marginTop: number;
  marginBottom: number;
  children: LayoutNode[];
  lines: LineBox[];
}

export interface PaintOp {
  z: 0 | 1 | 2;
  order: number;
  kind: 'bg' | 'border' | 'text';
  box: Box;
  color?: Color;
  borderWidths?: Record<'top' | 'right' | 'bottom' | 'left', number>;
  borderColors?: Record<'top' | 'right' | 'bottom' | 'left', Color>;
  text?: {
    runs: { text: string; x: number; baseline: number }[];
    fontSize: number;
    family: string;
    color: Color;
  };
}

export interface RootLayout {
  root: LayoutNode;
  bodyHeight: number;
  bodyStyle: ComputedStyle;
  floats: FloatManager;
  paints: PaintOp[];
}

function collapseMargins(a: number, b: number): number {
  const maxPos = Math.max(a, b, 0);
  const sumNeg = (a < 0 ? a : 0) + (b < 0 ? b : 0);
  return maxPos + sumNeg;
}

export function layoutRoot(
  body: P5Element,
  styles: Map<P5Element, ComputedStyle>,
  viewportWidth: number,
): RootLayout {
  const style = styles.get(body)!;
  const marginL = resolveLength(style.margin.left, viewportWidth) ?? 0;
  const marginR = resolveLength(style.margin.right, viewportWidth) ?? 0;
  const marginT = resolveLength(style.margin.top, viewportWidth) ?? 0;
  const padL = resolveLength(style.padding.left, viewportWidth) ?? 0;
  const padR = resolveLength(style.padding.right, viewportWidth) ?? 0;
  const padT = resolveLength(style.padding.top, viewportWidth) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const bT = style.borderWidth.top;

  const specW = resolveLength(style.width, viewportWidth);
  const borderBoxWidth =
    specW !== null
      ? style.boxSizing === 'border-box'
        ? specW
        : specW + padL + padR + bL + bR
      : Math.max(0, viewportWidth - marginL - marginR);

  const borderX = marginL;
  const borderY = marginT;
  const contentX = borderX + bL + padL;
  const contentY = borderY + bT + padT;
  const contentWidth = Math.max(0, borderBoxWidth - bL - bR - padL - padR);

  const fm = new FloatManager(contentX, contentWidth);
  const paints: PaintOp[] = [];
  let order = 0;

  // Body background propagates to the canvas and paints behind everything.
  if (style.backgroundColor.a > 0) {
    paints.push({
      z: 0,
      order: order++,
      kind: 'bg',
      box: { x: 0, y: 0, width: viewportWidth, height: 0 },
      color: style.backgroundColor,
    });
  }

  const bodyNode = layoutElementBox(
    body,
    style,
    fm,
    borderX,
    borderY,
    borderBoxWidth,
    contentX,
    contentY,
    contentWidth,
    styles,
    paints,
    () => order++,
  );

  if (style.backgroundColor.a > 0) {
    paints[0].box.height = bodyNode.borderHeight + marginT;
  }

  paints.sort((a, b) => (a.z === b.z ? a.order - b.order : a.z - b.z));

  return {
    root: bodyNode,
    bodyHeight: bodyNode.borderHeight,
    bodyStyle: style,
    floats: fm,
    paints,
  };
}

/** Does this element have direct inline content (text) rather than block children? */
function hasInlineContent(el: P5Element, styles: Map<P5Element, ComputedStyle>): boolean {
  for (const child of el.childNodes) {
    if (child.nodeName === '#text') {
      if (/\S/.test((child as P5Text).value)) return true;
    } else if (child.nodeName !== '#comment') {
      const s = styles.get(child as P5Element);
      if (s && (s.display === 'block' || s.display === 'grid' || s.float !== 'none')) continue;
      return true;
    }
  }
  return false;
}

function collectInlineText(el: P5Element, styles: Map<P5Element, ComputedStyle>): string {
  let out = '';
  for (const child of el.childNodes) {
    if (child.nodeName === '#text') {
      out += (child as P5Text).value;
    } else if (child.nodeName !== '#comment') {
      const s = styles.get(child as P5Element);
      if (s && (s.display === 'block' || s.display === 'grid')) continue;
      out += collectInlineText(child as P5Element, styles);
    }
  }
  return out;
}

interface LayoutBlockInput {
  fm: FloatManager;
  contentX: number;
  contentWidth: number;
  /** content box top (absolute) — the current flow position. */
  y: number;
  prevBottomMargin: number;
}

/** Lay out an element's border box and inline/block content. */
export function layoutElementBox(
  el: P5Element,
  style: ComputedStyle,
  fm: FormattingContext,
  borderX: number,
  borderY: number,
  borderWidth: number,
  contentX: number,
  contentY: number,
  contentWidth: number,
  styles: Map<P5Element, ComputedStyle>,
  paints: PaintOp[],
  nextOrder: () => number,
  forcedHeight?: number,
): LayoutNode {
  const children: LayoutNode[] = [];
  let lines: LineBox[] = [];
  let contentHeight = 0;

  // An element's own background/border paints before its contents (CSS
  // painting order: parent background first, then children in source order).
  // Placeholders (height 0) are pushed here and finalized after layout so the
  // order counter keeps them ahead of every child op.
  const ownBg = style.backgroundColor.a > 0
    ? {
        z: 0 as const,
        order: nextOrder(),
        kind: 'bg' as const,
        box: { x: borderX, y: borderY, width: borderWidth, height: 0 },
        color: style.backgroundColor,
      }
    : null;
  if (ownBg) paints.push(ownBg);
  const ownBorder = pushBorders(paints, nextOrder, 0, style, borderX, borderY, borderWidth, 0);


  const bT = style.borderWidth.top;
  const bB = style.borderWidth.bottom;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const padT = resolveLength(style.padding.top, contentWidth) ?? 0;
  const padB = resolveLength(style.padding.bottom, contentWidth) ?? 0;
  const padL = resolveLength(style.padding.left, contentWidth) ?? 0;
  const padR = resolveLength(style.padding.right, contentWidth) ?? 0;
  const padBorderV = padT + padB + bT + bB;
  const padBorderH = padL + padR + bL + bR;

  const isGrid = style.display === 'grid' || style.display === 'inline-grid';
  if (isGrid) {
    const specH = resolveLength(style.height, contentWidth);
    const availableHeight =
      specH !== null
        ? Math.max(0, (style.boxSizing === 'border-box' ? specH : specH + padBorderV) - padBorderV)
        : null;
    const res = layoutGridChildren({
      el,
      style,
      styles,
      contentX,
      contentY,
      contentWidth,
      availableHeight,
      paints,
      nextOrder,
    });
    children.push(...res.children);
    contentHeight = res.height;
  } else if (hasInlineContent(el, styles)) {
    const text = collectInlineText(el, styles);
    const lineRes = layoutTextLines({
      text,
      x: contentX,
      y: contentY,
      width: contentWidth,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
      family: style.fontFamily,
      available: (top, bottom) => {
        const i = fm.floatIntrusion(top, bottom);
        return { x: contentX + i.left, width: contentWidth - i.left - i.right };
      },
    });
    lines = lineRes.lines;
    contentHeight = lineRes.height;
  } else {
    const hasBlocks = el.childNodes.some((c) => c.nodeName !== '#text' && c.nodeName !== '#comment');
    if (hasBlocks) {
      const childFm = new FloatManager(contentX, contentWidth);
      const state: LayoutBlockInput = { fm: childFm, contentX, contentWidth, y: contentY, prevBottomMargin: 0 };
      const { nodes, height } = layoutBlockChildren(el, state, styles, paints, nextOrder);
      children.push(...nodes);
      contentHeight = height;
      // A BFC's height grows to include its floats.
      const lowest = childFm.lowestFloatBottom('both');
      if (Number.isFinite(lowest)) contentHeight = Math.max(contentHeight, lowest - contentY);
    }
  }

  const specH = resolveLength(style.height, contentWidth);
  const resolvedHeight =
    forcedHeight !== undefined
      ? forcedHeight
      : specH !== null
        ? style.boxSizing === 'border-box'
          ? specH
          : specH + padBorderV
        : contentHeight + padBorderV;

  const node: LayoutNode = {
    element: el,
    style,
    borderX,
    borderY,
    borderWidth,
    borderHeight: resolvedHeight,
    contentX,
    contentY,
    contentWidth: Math.max(0, contentWidth),
    contentHeight,
    isFloat: false,
    marginTop: 0,
    marginBottom: 0,
    children,
    lines,
  };

  if (ownBg) ownBg.box.height = resolvedHeight;
  if (ownBorder) ownBorder.box.height = resolvedHeight;
  if (lines.length > 0) {
    paints.push({
      z: 2,
      order: nextOrder(),
      kind: 'text',
      box: { x: borderX, y: borderY, width: borderWidth, height: resolvedHeight },
      text: {
        runs: lines.map((l) => ({
          text: l.text,
          x: l.x,
          baseline: l.y + (style.lineHeight + style.fontSize * 0.75) / 2,
        })),
        fontSize: style.fontSize,
        family: style.fontFamily,
        color: style.color,
      },
    });
  }
  void padBorderH;
  return node;
}

/** Lay out one in-flow block-level child of a formatting context. */
function layoutBlock(
  el: P5Element,
  style: ComputedStyle,
  ctx: LayoutBlockInput,
  styles: Map<P5Element, ComputedStyle>,
  paints: PaintOp[],
  nextOrder: () => number,
): LayoutNode {
  const { fm, contentX, contentWidth, y, prevBottomMargin } = ctx;
  const marginL = resolveLength(style.margin.left, contentWidth) ?? 0;
  const marginR = resolveLength(style.margin.right, contentWidth) ?? 0;
  const marginT = resolveLength(style.margin.top, contentWidth) ?? 0;
  const marginB = resolveLength(style.margin.bottom, contentWidth) ?? 0;

  const padL = resolveLength(style.padding.left, contentWidth) ?? 0;
  const padR = resolveLength(style.padding.right, contentWidth) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;

  const specW = resolveLength(style.width, contentWidth);
  const padBorderH = padL + padR + bL + bR;
  const autoWidth = Math.max(0, contentWidth - marginL - marginR);
  const borderBoxWidth =
    specW !== null
      ? style.boxSizing === 'border-box'
        ? specW
        : specW + padBorderH
      : autoWidth;

  // Vertical: margin collapsing with the previous sibling, then clearance.
  const collapsed = collapseMargins(prevBottomMargin, marginT);
  let borderTop = y + collapsed - prevBottomMargin;
  if (style.clear !== 'none') {
    const fb = fm.lowestFloatBottom(style.clear);
    if (Number.isFinite(fb)) borderTop = Math.max(borderTop, fb);
  }

  // BFC-establishing blocks must not overlap floats: shift right and shrink.
  const establishesBFC = style.overflow !== 'visible';
  let borderX = contentX + marginL;
  let usableWidth = borderBoxWidth;
  if (establishesBFC) {
    const i = fm.floatIntrusion(borderTop, borderTop + Math.max(borderBoxWidth, 1));
    borderX = contentX + marginL + i.left;
    if (specW === null) usableWidth = Math.max(0, autoWidth - i.left - i.right);
  }

  const node = layoutElementBox(
    el,
    style,
    fm,
    borderX,
    borderTop,
    usableWidth,
    borderX + bL + padL,
    borderTop + style.borderWidth.top + (resolveLength(style.padding.top, contentWidth) ?? 0),
    Math.max(0, usableWidth - bL - bR - padL - padR),
    styles,
    paints,
    nextOrder,
  );
  node.marginTop = marginT;
  node.marginBottom = marginB;
  return node;
}

/** Place and lay out one float child. */
function layoutFloat(
  el: P5Element,
  style: ComputedStyle,
  ctx: LayoutBlockInput,
  styles: Map<P5Element, ComputedStyle>,
  paints: PaintOp[],
  nextOrder: () => number,
): LayoutNode {
  const { fm, contentX, contentWidth, y } = ctx;
  const marginL = resolveLength(style.margin.left, contentWidth) ?? 0;
  const marginR = resolveLength(style.margin.right, contentWidth) ?? 0;
  const marginT = resolveLength(style.margin.top, contentWidth) ?? 0;
  const marginB = resolveLength(style.margin.bottom, contentWidth) ?? 0;
  const padL = resolveLength(style.padding.left, contentWidth) ?? 0;
  const padR = resolveLength(style.padding.right, contentWidth) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const bT = style.borderWidth.top;
  const bB = style.borderWidth.bottom;

  const specW = resolveLength(style.width, contentWidth);
  const padBorderH = padL + padR + bL + bR;
  let borderBoxWidth: number;
  if (specW !== null) {
    borderBoxWidth = style.boxSizing === 'border-box' ? specW : specW + padBorderH;
  } else {
    // shrink-to-fit: min(max-content, max(min-content, available))
    const text = collectInlineText(el, styles).trim();
    const fullWidth = measureTextWidth(text, style.fontSize, style.fontFamily);
    const widest = Math.max(0, ...text.split(/\s+/).map((w) => measureTextWidth(w, style.fontSize, style.fontFamily)));
    const available = contentWidth - marginL - marginR;
    borderBoxWidth = Math.min(fullWidth, Math.max(widest, available));
  }
  const floatContentWidth = Math.max(0, borderBoxWidth - bL - bR - padL - padR);

  // Float content lays out in its own BFC (a fresh float list).
  let contentHeight = 0;
  let lines: LineBox[] = [];
  if (hasInlineContent(el, styles)) {
    const lineRes = layoutTextLines({
      text: collectInlineText(el, styles),
      x: 0,
      y: 0,
      width: floatContentWidth,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
      family: style.fontFamily,
      available: (top, bottom) => ({ x: 0, width: floatContentWidth }),
    });
    lines = lineRes.lines;
    contentHeight = lineRes.height;
  }

  const padT = resolveLength(style.padding.top, floatContentWidth) ?? 0;
  const padB = resolveLength(style.padding.bottom, floatContentWidth) ?? 0;
  const padBorderV = padT + padB + bT + bB;
  const specH = resolveLength(style.height, floatContentWidth);
  const borderHeight =
    specH !== null
      ? style.boxSizing === 'border-box'
        ? specH
        : specH + padBorderV
      : contentHeight + padBorderV;

  const placed = fm.placeFloat(
    {
      isLeft: style.float === 'left',
      marginLeft: marginL,
      marginRight: marginR,
      marginTop: marginT,
      marginBottom: marginB,
      borderWidth: borderBoxWidth,
      borderHeight,
      element: el,
    },
    y,
  );

  const node: LayoutNode = {
    element: el,
    style,
    borderX: placed.borderX,
    borderY: placed.borderY,
    borderWidth: borderBoxWidth,
    borderHeight,
    contentX: placed.borderX + bL + padL,
    contentY: placed.borderY + bT + padT,
    contentWidth: floatContentWidth,
    contentHeight,
    isFloat: true,
    marginTop: marginT,
    marginBottom: marginB,
    children: [],
    lines,
  };

  if (style.backgroundColor.a > 0) {
    paints.push({
      z: 1,
      order: nextOrder(),
      kind: 'bg',
      box: { x: placed.borderX, y: placed.borderY, width: borderBoxWidth, height: borderHeight },
      color: style.backgroundColor,
    });
  }
  pushBorders(paints, nextOrder, 1, style, placed.borderX, placed.borderY, borderBoxWidth, borderHeight);
  if (lines.length > 0) {
    paints.push({
      z: 2,
      order: nextOrder(),
      kind: 'text',
      box: { x: placed.borderX, y: placed.borderY, width: borderBoxWidth, height: borderHeight },
      text: {
        runs: lines.map((l) => ({
          text: l.text,
          x: placed.borderX + l.x,
          baseline: placed.borderY + l.y + (style.lineHeight + style.fontSize * 0.75) / 2,
        })),
        fontSize: style.fontSize,
        family: style.fontFamily,
        color: style.color,
      },
    });
  }
  return node;
}

function layoutBlockChildren(
  parent: P5Element,
  ctx: LayoutBlockInput,
  styles: Map<P5Element, ComputedStyle>,
  paints: PaintOp[],
  nextOrder: () => number,
): { nodes: LayoutNode[]; height: number } {
  const nodes: LayoutNode[] = [];
  let y = ctx.y;
  let prevBottomMargin = 0;
  for (const child of parent.childNodes) {
    if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
    const el = child as P5Element;
    const style = styles.get(el);
    if (!style || style.display === 'none') continue;
    if (style.float !== 'none') {
      nodes.push(layoutFloat(el, style, { ...ctx, y }, styles, paints, nextOrder));
      continue;
    }
    const node = layoutBlock(el, style, { ...ctx, y, prevBottomMargin }, styles, paints, nextOrder);
    nodes.push(node);
    y = node.borderY + node.borderHeight + node.marginBottom;
    prevBottomMargin = node.marginBottom;
  }
  return { nodes, height: y - ctx.y };
}

function pushBorders(
  paints: PaintOp[],
  nextOrder: () => number,
  z: 0 | 1,
  style: ComputedStyle,
  x: number,
  y: number,
  w: number,
  h: number,
): PaintOp | null {
  const widths = {
    top: style.borderWidth.top,
    right: style.borderWidth.right,
    bottom: style.borderWidth.bottom,
    left: style.borderWidth.left,
  };
  if (!(widths.top || widths.right || widths.bottom || widths.left)) return null;
  const op: PaintOp = {
    z,
    order: nextOrder(),
    kind: 'border',
    box: { x, y, width: w, height: h },
    borderWidths: widths,
    borderColors: {
      top: style.borderColor.top,
      right: style.borderColor.right,
      bottom: style.borderColor.bottom,
      left: style.borderColor.left,
    },
  };
  paints.push(op);
  return op;
}
