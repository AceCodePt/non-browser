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

import { parseStyleAttribute, pxLength, resolveLength, makeStyle, type BorderRadius, type ComputedStyle, type Color, type Declaration, type DecorationLine, type Viewport } from './css.js';
import { layoutTextLines, measureTextWidth, type LineBox } from './measure.js';
import { FloatManager, type FormattingContext } from './floats.js';
import { layoutGridChildren } from './grid.js';
import { layoutFlexChildren } from './flexbox.js';
import { layoutPositionedChild, initialContainingBlock, type ContainingBlock } from './positioning.js';
import { hasNonZeroRadius, type RoundedClip } from './radius.js';
import type { P5Element, P5Text } from './types.js';
import type { Box } from '../harness/fixtures.js';

export { FloatManager };
export type { FormattingContext };
export { layoutPositionedChild, initialContainingBlock } from './positioning.js';

export interface StyleDefaults {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: Color;
  letterSpacing: number;
  textDecorationLines: DecorationLine[];
  textDecorationColor: Color | null;
  textDecorationThickness: 'auto' | 'from-font' | { px: number };
  textUnderlineOffset: number;
}

export function resolveStyles(
  root: P5Element,
  defaults: StyleDefaults,
  stylesheetDecls?: Map<P5Element, Declaration[]>,
): Map<P5Element, ComputedStyle> {
  const map = new Map<P5Element, ComputedStyle>();
  const walk = (el: P5Element, d: StyleDefaults): void => {
    const inline = parseStyleAttribute(el.attrs.find((a) => a.name === 'style')?.value);
    const cascade = stylesheetDecls?.get(el);
    // makeStyle reads the FIRST declaration of each property, so to get CSS
    // "last wins" semantics across the cascade (stylesheet rules in ascending
    // specificity/source order, then inline styles) feed the merged list in
    // reverse — the winner appears first.
    const decls = cascade && cascade.length > 0 ? [...cascade, ...inline].reverse() : inline;
    const style = makeStyle(decls, { ...d, display: 'block' });
    applyReplacedSize(el, style);
    map.set(el, style);
    const childDefaults: StyleDefaults = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      color: style.color,
      letterSpacing: style.letterSpacing,
      textDecorationLines: style.textDecorationLines,
      textDecorationColor: style.textDecorationColor,
      textDecorationThickness: style.textDecorationThickness,
      textUnderlineOffset: style.textUnderlineOffset,
    };
    for (const child of el.childNodes) {
      if (child.nodeName !== '#text') {
        const name = (child as P5Element).nodeName;
        if (name === 'style' || name === 'script' || name === 'head' || name === 'title') continue;
        walk(child as P5Element, childDefaults);
      }
    }
  };
  walk(root, defaults);
  return map;
}

/**
 * Replaced elements (<img>, <canvas>) size their box from their `width`/`height`
 * attributes when no CSS size is set — the "empty replaced box at layout size"
 * contract from the charter (no image decoding in v1; the box is laid out but
 * paints nothing unless it has a background/border). `<canvas>` without
 * attributes defaults to 300x150 per the HTML spec.
 */
function applyReplacedSize(el: P5Element, style: ComputedStyle): void {
  const tag = el.nodeName;
  if (tag !== 'img' && tag !== 'canvas') return;
  const attr = (name: string): string | undefined => el.attrs.find((a) => a.name === name)?.value;
  const numeric = (v: string | undefined): number | null => (v !== undefined && /^\d+$/.test(v) ? parseInt(v, 10) : null);
  if (style.width.auto) {
    const w = numeric(attr('width'));
    style.width = pxLength(w ?? (tag === 'canvas' ? 300 : 0));
  }
  if (style.height.auto) {
    const h = numeric(attr('height'));
    style.height = pxLength(h ?? (tag === 'canvas' ? 150 : 0));
  }
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
  /** border-box top before relative offsets are applied (flow position). */
  flowY: number;
  children: LayoutNode[];
  lines: LineBox[];
}

export interface TextDecorationPaint {
  lines: DecorationLine[];
  color: Color;
  thickness: 'auto' | 'from-font' | { px: number };
  /** text-underline-offset in px. */
  underlineOffset: number;
}

export interface PaintOp {
  /** stacking key: the paint-order path (CSS 2.1 Appendix E, linearized). */
  key: number[];
  order: number;
  kind: 'bg' | 'border' | 'text';
  box: Box;
  color?: Color;
  borderWidths?: Record<'top' | 'right' | 'bottom' | 'left', number>;
  borderColors?: Record<'top' | 'right' | 'bottom' | 'left', Color>;
  /** rounded-corner radii for this box's background/border paint. */
  borderRadius?: BorderRadius;
  /** rounded-rect clip from a rounded overflow:hidden ancestor (border box). */
  clip?: RoundedClip;
  text?: {
    runs: { text: string; x: number; y: number; width: number; height: number; baseline: number }[];
    fontSize: number;
    family: string;
    color: Color;
    letterSpacing: number;
    decoration: TextDecorationPaint | null;
  };
}

export interface RootLayout {
  root: LayoutNode;
  bodyHeight: number;
  bodyStyle: ComputedStyle;
  floats: FloatManager;
  paints: PaintOp[];
}

// ===== paint stacking + containing-block state =====
// Layout is a single-threaded recursive descent, so module-level stacks are
// safe and let grid/flexbox (which delegate children to layoutElementBox)
// inherit the current context without threading parameters through them.

/** Levels for the CSS 2.1 Appendix E steps, linearized into sort keys. */
const STEP_INFLOW = 3;
const STEP_FLOAT = 4;
const STEP_INLINE = 5;
const STEP_POSITIONED = 6;

let paintScPath: number[] = [];
let paintZAutoStack: boolean[] = [];
let paintZAutoActive = false;

let cbStack: ContainingBlock[] = [];

/**
 * Active rounded overflow clips. Each entry is the border box of a rounded
 * `overflow:hidden` ancestor; paint ops pushed while an entry is on the stack
 * are clipped to it (its `box` object is mutated once the ancestor's final
 * border-box height is known, so ops reference the final rect).
 */
let clipStack: RoundedClip[] = [];

/** Push a paint op, tagging it with the innermost active rounded clip. */
function pushPaintOp(paints: PaintOp[], op: PaintOp): void {
  const clip = clipStack.length > 0 ? clipStack[clipStack.length - 1] : null;
  if (clip) op.clip = clip;
  paints.push(op);
}

/** The root containing block (the viewport); pending root abs/fixed boxes. */
let icbEntry: ContainingBlock = { rect: { x: 0, y: 0, width: 0, height: 0 }, heightKnown: true, pending: [] };

function paintLevelFor(style: ComputedStyle): number {
  const z = style.zIndex;
  if (z === null || z === 0) return STEP_POSITIONED;
  if (z < 0) return z;
  return STEP_POSITIONED + z;
}

/** Key for in-flow/float/inline content at the current stacking position. */
function inFlowPaintKey(step: number): number[] {
  return [...paintScPath, paintZAutoActive ? STEP_POSITIONED : step];
}

function pushPositionedPaint(style: ComputedStyle): { key: number[]; scPushed: boolean } {
  if (style.zIndex === null) {
    paintZAutoStack.push(paintZAutoActive);
    paintZAutoActive = true;
    return { key: [...paintScPath, STEP_POSITIONED], scPushed: false };
  }
  paintScPath.push(paintLevelFor(style));
  paintZAutoStack.push(paintZAutoActive);
  paintZAutoActive = false;
  return { key: [...paintScPath], scPushed: true };
}

function popPositionedPaint(saved: { scPushed: boolean }): void {
  if (saved.scPushed) paintScPath.pop();
  paintZAutoActive = paintZAutoStack.pop() ?? false;
}

function comparePaintKeys(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

function collapseMargins(a: number, b: number): number {
  const maxPos = Math.max(a, b, 0);
  const sumNeg = (a < 0 ? a : 0) + (b < 0 ? b : 0);
  return maxPos + sumNeg;
}

export function layoutRoot(
  body: P5Element,
  styles: Map<P5Element, ComputedStyle>,
  viewport: Viewport,
): RootLayout {
  const style = styles.get(body)!;
  const viewportWidth = viewport.width;

  // Reset per-render stacking/containing-block state.
  paintScPath = [];
  paintZAutoStack = [];
  paintZAutoActive = false;
  cbStack = [];
  clipStack = [];
  icbEntry = { rect: initialContainingBlock(viewport), heightKnown: true, pending: [] };
  cbStack.push(icbEntry);

  const marginL = resolveLength(style.margin.left, viewportWidth, viewport) ?? 0;
  const marginR = resolveLength(style.margin.right, viewportWidth, viewport) ?? 0;
  const marginT = resolveLength(style.margin.top, viewportWidth, viewport) ?? 0;
  const padL = resolveLength(style.padding.left, viewportWidth, viewport) ?? 0;
  const padR = resolveLength(style.padding.right, viewportWidth, viewport) ?? 0;
  const padT = resolveLength(style.padding.top, viewportWidth, viewport) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const bT = style.borderWidth.top;

  const specW = resolveLength(style.width, viewportWidth, viewport);
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
    pushPaintOp(paints, {
      key: [],
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
    viewport,
  );

  if (style.backgroundColor.a > 0) {
    paints[0].box.height = bodyNode.borderHeight + marginT;
  }

  // Out-of-flow boxes with no positioned ancestor resolve against the ICB.
  for (const p of icbEntry.pending) {
    const node = layoutPositionedChild(
      p.el,
      p.style,
      icbEntry.rect,
      p.staticX,
      p.staticY,
      styles,
      paints,
      () => order++,
      viewport,
    );
    bodyNode.children.push(node);
  }
  cbStack.pop();

  paints.sort((a, b) => comparePaintKeys(a.key, b.key) || a.order - b.order);

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
      if (s && (s.display === 'block' || s.display === 'grid' || s.display === 'flex' || s.float !== 'none')) continue;
      return true;
    }
  }
  return false;
}

export function collectInlineText(el: P5Element, styles: Map<P5Element, ComputedStyle>): string {
  let out = '';
  for (const child of el.childNodes) {
    if (child.nodeName === '#text') {
      out += (child as P5Text).value;
    } else if (child.nodeName !== '#comment') {
      const s = styles.get(child as P5Element);
      if (s && (s.display === 'block' || s.display === 'grid' || s.display === 'flex')) continue;
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
  viewport?: Viewport,
  forcedHeight?: number,
): LayoutNode {
  const children: LayoutNode[] = [];
  let lines: LineBox[] = [];
  let contentHeight = 0;

  const bT = style.borderWidth.top;
  const bB = style.borderWidth.bottom;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const padT = resolveLength(style.padding.top, contentWidth, viewport) ?? 0;
  const padB = resolveLength(style.padding.bottom, contentWidth, viewport) ?? 0;
  const padL = resolveLength(style.padding.left, contentWidth, viewport) ?? 0;
  const padR = resolveLength(style.padding.right, contentWidth, viewport) ?? 0;
  const padBorderV = padT + padB + bT + bB;
  const padBorderH = padL + padR + bL + bR;

  // Positioned boxes push their paint key and containing block for the whole
  // subtree; their own background/border is keyed to the pushed level.
  const positioned = style.position !== 'static';
  let posPaint: { key: number[]; scPushed: boolean } | null = null;
  let ownKey: number[];
  let cbEntry: ContainingBlock | null = null;
  if (positioned) {
    posPaint = pushPositionedPaint(style);
    ownKey = posPaint.key;
    if (style.position === 'fixed') {
      cbEntry = {
        rect: initialContainingBlock(viewport ?? { width: 0, height: 0 }),
        heightKnown: true,
        pending: [],
      };
    } else {
      const specH = resolveLength(style.height, contentWidth, viewport);
      cbEntry = {
        rect: {
          x: borderX,
          y: borderY,
          width: borderWidth,
          height:
            specH !== null
              ? Math.max(0, (style.boxSizing === 'border-box' ? specH : specH + padBorderV) - bT - bB)
              : 0,
        },
        heightKnown: specH !== null,
        pending: [],
      };
    }
    cbStack.push(cbEntry);
  } else {
    ownKey = inFlowPaintKey(STEP_INFLOW);
  }

  // An element's own background/border paints before its contents (CSS
  // painting order: parent background first, then children in source order).
  // Placeholders (height 0) are pushed here and finalized after layout so the
  // order counter keeps them ahead of every child op.
  const ownBg = style.backgroundColor.a > 0
    ? {
        key: ownKey,
        order: nextOrder(),
        kind: 'bg' as const,
        box: { x: borderX, y: borderY, width: borderWidth, height: 0 },
        color: style.backgroundColor,
        borderRadius: style.borderRadius,
      }
    : null;
  if (ownBg) pushPaintOp(paints, ownBg);
  const ownBorder = pushBorders(paints, nextOrder, ownKey, style, borderX, borderY, borderWidth, 0);

  // A rounded overflow:hidden box clips its whole subtree (own background and
  // border excluded) to its border-box rounded rect. The clip box is a shared
  // mutable object: ops reference it, and its height is finalized once the
  // border-box height is known below.
  let clipEntry: RoundedClip | null = null;
  if (style.overflow === 'hidden' && hasNonZeroRadius(style.borderRadius)) {
    clipEntry = {
      x: borderX,
      y: borderY,
      width: borderWidth,
      height: 0,
      radii: style.borderRadius,
    };
    clipStack.push(clipEntry);
  }

  const isGrid = style.display === 'grid' || style.display === 'inline-grid';
  if (isGrid) {
    const specH = resolveLength(style.height, contentWidth, viewport);
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
  } else if (style.display === 'flex') {
    const specH = resolveLength(style.height, contentWidth, viewport);
    const forcedContent = forcedHeight !== undefined ? Math.max(0, forcedHeight - padBorderV) : null;
    const availableHeight =
      forcedContent !== null
        ? forcedContent
        : specH !== null
          ? Math.max(0, (style.boxSizing === 'border-box' ? specH : specH + padBorderV) - padBorderV)
          : null;
    const res = layoutFlexChildren({
      el,
      style,
      styles,
      contentX,
      contentY,
      contentWidth,
      availableHeight,
      paints,
      nextOrder,
      viewport,
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
      letterSpacing: style.letterSpacing,
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
      const { nodes, height } = layoutBlockChildren(el, state, styles, paints, nextOrder, viewport);
      children.push(...nodes);
      contentHeight = height;
      // A BFC's height grows to include its floats.
      const lowest = childFm.lowestFloatBottom('both');
      if (Number.isFinite(lowest)) contentHeight = Math.max(contentHeight, lowest - contentY);
    }
  }

  const specH = resolveLength(style.height, contentWidth, viewport);
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
    flowY: borderY,
    children,
    lines,
  };

  if (ownBg) ownBg.box.height = resolvedHeight;
  if (ownBorder) ownBorder.box.height = resolvedHeight;
  if (clipEntry) clipEntry.height = resolvedHeight;
  if (lines.length > 0) {
    pushPaintOp(paints, {
      key: inFlowPaintKey(STEP_INLINE),
      order: nextOrder(),
      kind: 'text',
      box: { x: borderX, y: borderY, width: borderWidth, height: resolvedHeight },
      text: {
        runs: lines.map((l) => ({
          text: l.text,
          x: l.x,
          y: l.y,
          width: l.width,
          height: l.height,
          baseline: l.y + (style.lineHeight + style.fontSize * 0.75) / 2,
        })),
        fontSize: style.fontSize,
        family: style.fontFamily,
        color: style.color,
        letterSpacing: style.letterSpacing,
        decoration: decorationPaint(style),
      },
    });
  }

  // A positioned element is the containing block for its out-of-flow
  // descendants: finalize its padding-box height and lay them out.
  if (cbEntry) {
    if (!cbEntry.heightKnown) {
      cbEntry.rect.height = Math.max(0, contentHeight + padT + padB);
      cbEntry.heightKnown = true;
    }
    for (const p of cbEntry.pending) {
      const cb = p.fixed ? icbEntry.rect : cbEntry.rect;
      const posNode = layoutPositionedChild(
        p.el,
        p.style,
        cb,
        p.staticX,
        p.staticY,
        styles,
        paints,
        nextOrder,
        viewport,
      );
      children.push(posNode);
    }
    cbStack.pop();
  }
  if (clipEntry) clipStack.pop();
  if (posPaint) popPositionedPaint(posPaint);
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
  viewport?: Viewport,
): LayoutNode {
  const { fm, contentX, contentWidth, y, prevBottomMargin } = ctx;
  const marginL = resolveLength(style.margin.left, contentWidth, viewport) ?? 0;
  const marginR = resolveLength(style.margin.right, contentWidth, viewport) ?? 0;
  const marginT = resolveLength(style.margin.top, contentWidth, viewport) ?? 0;
  const marginB = resolveLength(style.margin.bottom, contentWidth, viewport) ?? 0;

  const padL = resolveLength(style.padding.left, contentWidth, viewport) ?? 0;
  const padR = resolveLength(style.padding.right, contentWidth, viewport) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;

  const specW = resolveLength(style.width, contentWidth, viewport);
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

  // Relative offsets shift the box without affecting in-flow layout; the next
  // sibling still starts at the un-offset flow position.
  const cbRect = cbStack[cbStack.length - 1].rect;
  let paintX = borderX;
  let paintY = borderTop;
  if (style.position === 'relative') {
    const offL = resolveLength(style.left, cbRect.width, viewport);
    const offR = resolveLength(style.right, cbRect.width, viewport);
    const offT = resolveLength(style.top, cbRect.height, viewport);
    const offB = resolveLength(style.bottom, cbRect.height, viewport);
    paintX = borderX + (offL !== null ? offL : offR !== null ? -offR : 0);
    paintY = borderTop + (offT !== null ? offT : offB !== null ? -offB : 0);
  }

  const node = layoutElementBox(
    el,
    style,
    fm,
    paintX,
    paintY,
    usableWidth,
    paintX + bL + padL,
    paintY + style.borderWidth.top + (resolveLength(style.padding.top, contentWidth, viewport) ?? 0),
    Math.max(0, usableWidth - bL - bR - padL - padR),
    styles,
    paints,
    nextOrder,
    viewport,
  );
  node.marginTop = marginT;
  node.marginBottom = marginB;
  node.flowY = borderTop;
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
  viewport?: Viewport,
): LayoutNode {
  const { fm, contentX, contentWidth, y } = ctx;
  const marginL = resolveLength(style.margin.left, contentWidth, viewport) ?? 0;
  const marginR = resolveLength(style.margin.right, contentWidth, viewport) ?? 0;
  const marginT = resolveLength(style.margin.top, contentWidth, viewport) ?? 0;
  const marginB = resolveLength(style.margin.bottom, contentWidth, viewport) ?? 0;
  const padL = resolveLength(style.padding.left, contentWidth, viewport) ?? 0;
  const padR = resolveLength(style.padding.right, contentWidth, viewport) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const bT = style.borderWidth.top;
  const bB = style.borderWidth.bottom;

  const specW = resolveLength(style.width, contentWidth, viewport);
  const padBorderH = padL + padR + bL + bR;
  let borderBoxWidth: number;
  if (specW !== null) {
    borderBoxWidth = style.boxSizing === 'border-box' ? specW : specW + padBorderH;
  } else {
    // shrink-to-fit: min(max-content, max(min-content, available))
    const text = collectInlineText(el, styles).trim();
    const ls = style.letterSpacing;
    const fullWidth = measureTextWidth(text, style.fontSize, style.fontFamily, ls);
    const widest = Math.max(
      0,
      ...text.split(/\s+/).map((w) => measureTextWidth(w, style.fontSize, style.fontFamily, ls)),
    );
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
      letterSpacing: style.letterSpacing,
      available: (top, bottom) => ({ x: 0, width: floatContentWidth }),
    });
    lines = lineRes.lines;
    contentHeight = lineRes.height;
  }

  const padT = resolveLength(style.padding.top, floatContentWidth, viewport) ?? 0;
  const padB = resolveLength(style.padding.bottom, floatContentWidth, viewport) ?? 0;
  const padBorderV = padT + padB + bT + bB;
  const specH = resolveLength(style.height, floatContentWidth, viewport);
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
    flowY: placed.borderY,
    children: [],
    lines,
  };

  if (style.backgroundColor.a > 0) {
    pushPaintOp(paints, {
      key: inFlowPaintKey(STEP_FLOAT),
      order: nextOrder(),
      kind: 'bg',
      box: { x: placed.borderX, y: placed.borderY, width: borderBoxWidth, height: borderHeight },
      color: style.backgroundColor,
      borderRadius: style.borderRadius,
    });
  }
  pushBorders(paints, nextOrder, inFlowPaintKey(STEP_FLOAT), style, placed.borderX, placed.borderY, borderBoxWidth, borderHeight);
  if (lines.length > 0) {
    pushPaintOp(paints, {
      key: inFlowPaintKey(STEP_INLINE),
      order: nextOrder(),
      kind: 'text',
      box: { x: placed.borderX, y: placed.borderY, width: borderBoxWidth, height: borderHeight },
      text: {
        runs: lines.map((l) => ({
          text: l.text,
          x: placed.borderX + l.x,
          y: placed.borderY + l.y,
          width: l.width,
          height: l.height,
          baseline: placed.borderY + l.y + (style.lineHeight + style.fontSize * 0.75) / 2,
        })),
        fontSize: style.fontSize,
        family: style.fontFamily,
        color: style.color,
        letterSpacing: style.letterSpacing,
        decoration: decorationPaint(style),
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
  viewport?: Viewport,
): { nodes: LayoutNode[]; height: number } {
  const nodes: LayoutNode[] = [];
  let y = ctx.y;
  let prevBottomMargin = 0;
  for (const child of parent.childNodes) {
    if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
    const el = child as P5Element;
    const style = styles.get(el);
    if (!style || style.display === 'none') continue;
    if (style.position === 'absolute' || style.position === 'fixed') {
      // Out of flow: recorded with its static position, laid out by the
      // nearest positioned ancestor once that box's height is final.
      cbStack[cbStack.length - 1].pending.push({
        el,
        style,
        staticX: ctx.contentX,
        staticY: y,
        fixed: style.position === 'fixed',
      });
      continue;
    }
    if (style.float !== 'none') {
      nodes.push(layoutFloat(el, style, { ...ctx, y }, styles, paints, nextOrder, viewport));
      continue;
    }
    const node = layoutBlock(el, style, { ...ctx, y, prevBottomMargin }, styles, paints, nextOrder, viewport);
    nodes.push(node);
    y = node.flowY + node.borderHeight + node.marginBottom;
    prevBottomMargin = node.marginBottom;
  }
  return { nodes, height: y - ctx.y };
}

/** Build the text-decoration paint descriptor for a style (null when no lines). */
function decorationPaint(style: ComputedStyle): TextDecorationPaint | null {
  if (style.textDecorationLines.length === 0) return null;
  return {
    lines: style.textDecorationLines,
    color: style.textDecorationColor ?? style.color,
    thickness: style.textDecorationThickness,
    underlineOffset: style.textUnderlineOffset,
  };
}

function pushBorders(
  paints: PaintOp[],
  nextOrder: () => number,
  key: number[],
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
    key,
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
    borderRadius: style.borderRadius,
  };
  pushPaintOp(paints, op);
  return op;
}
