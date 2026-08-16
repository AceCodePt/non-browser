/**
 * CSS Flexbox layout (css-flexbox-1 §9) — sized and stretched to match Blink.
 *
 * The container box is established by block-inline.ts, which calls
 * `layoutFlexChildren` for any element with display:flex. Each flex item is
 * then laid out through the ordinary block/inline machinery, so nested flex,
 * text wrapping and block content inside items come from the same code paths
 * the floats/grid corpora exercise.
 *
 * The algorithm follows css-flexbox-1:
 *   1. available main/cross sizes of the container
 *   2. flex base size and hypothetical main size per item
 *   3. hypothetical cross size per item
 *   4. container main size
 *   5. collect items into flex lines (wrap)
 *   6-7. resolve flexible lengths (flex-grow / flex-shrink) per line
 *   8. used main size per item
 *   9. hypothetical cross size (again) at the used main size
 *   10. justify-content along the main axis
 *   11-12. container cross size and line cross sizes (align-content)
 *   13. align-items/align-self along the cross axis (incl. baseline)
 *
 * All main-axis arithmetic (flex base, hypothetical, used, min/max sizes) is
 * done in border-box terms, matching Blink's LayoutFlexItem bookkeeping;
 * margins are kept outside ("outer" sizes). `flex-basis: auto` falls back to
 * the item's main-size property and then to its max-content size, and
 * `min-width/height: auto` supplies the content-based minimum in the main axis
 * (0 for scroll containers, per css-flexbox-1 §4.5).
 */

import {
  AUTO,
  pxLength,
  resolveLength,
  type ComputedStyle,
  type Length,
  type Viewport,
} from './css.js';
import { layoutTextLines, measureTextWidth } from './measure.js';
import { FloatManager, layoutElementBox, type LayoutNode, type PaintOp } from './block-inline.js';
import type { P5Element, P5Text } from './types.js';

const EPS = 0.001;

/**
 * Noto Sans vertical metrics (hhea ascent/descent / unitsPerEm), matching the
 * engine's registered font (fontmetrics.ts FALLBACK). Blink derives a line
 * box's baseline from the font's floored ascent/descent at the used font-size,
 * so baseline alignment must reproduce that to land text baselines where the
 * oracle does.
 */
const FONT_ASCENT_FRAC = 1069 / 1000;
const FONT_DESCENT_FRAC = 293 / 1000;

/** Baseline offset of a text line box from the content-box top (Blink's). */
function textBaselineOffset(fontSize: number, lineHeight: number): number {
  const ascent = Math.floor(fontSize * FONT_ASCENT_FRAC);
  const descent = Math.floor(fontSize * FONT_DESCENT_FRAC);
  return ascent + (lineHeight - ascent - descent) / 2;
}

export interface FlexLayoutInput {
  el: P5Element;
  style: ComputedStyle;
  styles: Map<P5Element, ComputedStyle>;
  contentX: number;
  contentY: number;
  contentWidth: number;
  /** container content-box height, or null when auto. */
  availableHeight: number | null;
  paints: PaintOp[];
  nextOrder: () => number;
  viewport?: Viewport;
}

interface FlexItem {
  el: P5Element;
  style: ComputedStyle;
  isAnonymous: boolean;
  order: number;
  flexGrow: number;
  flexShrink: number;
  mainStart: number;
  mainEnd: number;
  crossStart: number;
  crossEnd: number;
  mainStartAuto: boolean;
  mainEndAuto: boolean;
  crossStartAuto: boolean;
  crossEndAuto: boolean;
  padBorderMain: number;
  padBorderCross: number;
  flexBaseSize: number;
  minMainSize: number;
  maxMainSize: number;
  hypotheticalMainSize: number;
  usedMainSize: number;
  minCrossSize: number;
  maxCrossSize: number;
  hypotheticalCrossSize: number;
  usedCrossSize: number;
  /** baseline offset from the margin-box top (row direction baseline alignment). */
  baselineFromMarginBoxTop: number;
  crossDefinite: boolean;
  // flexible-length resolution state
  frozen: boolean;
  targetMainSize: number;
  // placement
  mainPos: number;
  borderX: number;
  borderY: number;
}

interface FlexLine {
  items: FlexItem[];
  crossSize: number;
  crossStart: number;
  baseline: number;
}

function isTextNode(n: unknown): n is P5Text {
  return typeof n === 'object' && n !== null && (n as { nodeName: string }).nodeName === '#text';
}

function isCommentNode(n: unknown): boolean {
  return typeof n === 'object' && n !== null && (n as { nodeName: string }).nodeName === '#comment';
}

function isElementNode(n: unknown): n is P5Element {
  return (
    typeof n === 'object' &&
    n !== null &&
    (n as { nodeName: string }).nodeName !== '#text' &&
    (n as { nodeName: string }).nodeName !== '#comment'
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function lenPx(l: Length, ref: number): number {
  if (l.auto) return 0;
  if (l.px !== null) return l.px;
  if (l.pct !== null) return (l.pct / 100) * ref;
  return 0;
}

function padInline(style: ComputedStyle, ref: number): number {
  return (
    (resolveLength(style.padding.left, ref) ?? 0) +
    (resolveLength(style.padding.right, ref) ?? 0) +
    style.borderWidth.left +
    style.borderWidth.right
  );
}

function padBlock(style: ComputedStyle, ref: number): number {
  return (
    (resolveLength(style.padding.top, ref) ?? 0) +
    (resolveLength(style.padding.bottom, ref) ?? 0) +
    style.borderWidth.top +
    style.borderWidth.bottom
  );
}

// ===================================================================
// Intrinsic content measurement (mirrors the grid module's helpers)
// ===================================================================

function hasInlineText(el: P5Element, styles: Map<P5Element, ComputedStyle>): boolean {
  for (const child of el.childNodes) {
    if (isTextNode(child)) {
      if (/\S/.test(child.value)) return true;
    } else if (isElementNode(child)) {
      const s = styles.get(child);
      if (s && (s.display === 'block' || s.display === 'grid' || s.display === 'flex')) continue;
      return true;
    }
  }
  return false;
}

function collectInlineText(el: P5Element, styles: Map<P5Element, ComputedStyle>): string {
  let out = '';
  for (const child of el.childNodes) {
    if (isTextNode(child)) {
      out += child.value;
    } else if (isElementNode(child)) {
      const s = styles.get(child);
      if (s && (s.display === 'block' || s.display === 'grid' || s.display === 'flex')) continue;
      out += collectInlineText(child, styles);
    }
  }
  return out;
}

/** min/max-content inline sizes of an element's content (content-box). */
function contentInlineSizes(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
): { min: number; max: number } {
  if (hasInlineText(el, styles)) {
    const text = collectInlineText(el, styles).replace(/[ \t\r\n\f]+/g, ' ').trim();
    let widest = 0;
    for (const w of text.split(' ')) {
      widest = Math.max(widest, measureTextWidth(w, style.fontSize, style.fontFamily, style.letterSpacing));
    }
    const full = measureTextWidth(text, style.fontSize, style.fontFamily, style.letterSpacing);
    return { min: widest, max: full };
  }
  let min = 0;
  let max = 0;
  for (const child of el.childNodes) {
    if (!isElementNode(child)) continue;
    const cs = styles.get(child);
    if (!cs || cs.display === 'none') continue;
    const c = inlineContribution(child, cs, styles);
    min = Math.max(min, c.min);
    max = Math.max(max, c.max);
  }
  return { min, max };
}

/** min/max-content contributions of an element in the inline axis (border-box). */
function inlineContribution(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
): { min: number; max: number } {
  const pb = padInline(style, 0);
  const specW = style.width;
  const minW = style.minWidth;
  const maxW = style.maxWidth;
  const borderBox = (len: Length): number | null =>
    len.auto ? null : style.boxSizing === 'border-box' ? len.px ?? null : len.px !== null ? len.px + pb : null;
  if (specW.px !== null) {
    const w = borderBox(specW);
    if (w !== null) {
      const lo = borderBox(minW) ?? 0;
      const hi = borderBox(maxW) ?? Infinity;
      return { min: clamp(w, lo, hi), max: clamp(w, lo, hi) };
    }
  }
  const content = contentInlineSizes(el, style, styles);
  const lo = minW.auto ? content.min + pb : (borderBox(minW) ?? 0);
  const hi = maxW.auto ? Infinity : (borderBox(maxW) ?? Infinity);
  return { min: clamp(content.min + pb, lo, hi), max: clamp(content.max + pb, lo, hi) };
}

/** Block-axis height of an element's content laid out at the given content width. */
function contentBlockHeight(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  contentW: number,
): number {
  const w = Math.max(0, contentW);
  if (hasInlineText(el, styles)) {
    const res = layoutTextLines({
      text: collectInlineText(el, styles),
      x: 0,
      y: 0,
      width: w,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
      family: style.fontFamily,
      whiteSpace: style.whiteSpace,
      available: () => ({ x: 0, width: w }),
    });
    return res.height;
  }
  let h = 0;
  for (const child of el.childNodes) {
    if (!isElementNode(child)) continue;
    const cs = styles.get(child);
    if (!cs || cs.display === 'none') continue;
    h += measureChildBlockHeight(child, cs, styles, w);
  }
  return h;
}

function measureChildBlockHeight(
  child: P5Element,
  cs: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  parentContentW: number,
): number {
  const mT = lenPx(cs.margin.top, parentContentW);
  const mB = lenPx(cs.margin.bottom, parentContentW);
  const mL = lenPx(cs.margin.left, parentContentW);
  const mR = lenPx(cs.margin.right, parentContentW);
  const borderW = Math.max(0, parentContentW - mL - mR);
  const innerW = Math.max(0, borderW - padInline(cs, borderW));
  const pb = padBlock(cs, borderW);
  const specH = cs.height;
  let h: number;
  if (specH.px !== null) {
    h = cs.boxSizing === 'border-box' ? specH.px : specH.px + pb;
  } else {
    h = contentBlockHeight(child, cs, styles, innerW) + pb;
  }
  const lo = cs.minHeight.px ?? 0;
  const hi = cs.maxHeight.px ?? Infinity;
  return clamp(h, lo, hi) + mT + mB;
}

// ===================================================================
// Flex item collection
// ===================================================================

/** Anonymous flex item style: no box decoration, flex: 0 1 auto. */
function anonymousStyle(container: ComputedStyle): ComputedStyle {
  return {
    ...container,
    display: 'block',
    width: AUTO,
    height: AUTO,
    minWidth: AUTO,
    maxWidth: AUTO,
    minHeight: AUTO,
    maxHeight: AUTO,
    margin: { top: AUTO, right: AUTO, bottom: AUTO, left: AUTO },
    padding: { top: pxLength(0), right: pxLength(0), bottom: pxLength(0), left: pxLength(0) },
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
    borderColor: { top: { r: 0, g: 0, b: 0, a: 1 }, right: { r: 0, g: 0, b: 0, a: 1 }, bottom: { r: 0, g: 0, b: 0, a: 1 }, left: { r: 0, g: 0, b: 0, a: 1 } },
    borderStyle: { top: 'none', right: 'none', bottom: 'none', left: 'none' },
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: AUTO,
    order: 0,
  };
}

function collectFlexItems(
  el: P5Element,
  container: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
): FlexItem[] {
  const items: FlexItem[] = [];
  let textBuf: P5Text[] = [];
  const flushText = () => {
    if (textBuf.length === 0) return;
    const value = textBuf.map((t) => t.value).join('');
    if (/\S/.test(value)) {
      const synthetic = {
        nodeName: 'div',
        tagName: 'div',
        attrs: [],
        childNodes: textBuf,
        namespaceURI: 'http://www.w3.org/1999/xhtml',
        parentNode: el,
      } as unknown as P5Element;
      items.push({
        el: synthetic,
        style: anonymousStyle(container),
        isAnonymous: true,
        order: 0,
        flexGrow: 0,
        flexShrink: 1,
      } as FlexItem);
    }
    textBuf = [];
  };

  for (const child of el.childNodes) {
    if (isCommentNode(child)) continue;
    if (isTextNode(child)) {
      textBuf.push(child);
      continue;
    }
    flushText();
    const cEl = child as P5Element;
    const cs = styles.get(cEl);
    if (!cs || cs.display === 'none') continue;
    items.push({
      el: cEl,
      style: cs,
      isAnonymous: false,
      order: cs.order,
      flexGrow: cs.flexGrow,
      flexShrink: cs.flexShrink,
    } as FlexItem);
  }
  flushText();
  items.sort((a, b) => a.order - b.order);
  return items;
}

// ===================================================================
// Top-level layout
// ===================================================================

export function layoutFlexChildren(input: FlexLayoutInput): { children: LayoutNode[]; height: number } {
  const { el, style, styles, contentX, contentY, contentWidth, availableHeight, paints, nextOrder, viewport } = input;

  const isRow = style.flexDirection === 'row' || style.flexDirection === 'row-reverse';
  const mainReverse = style.flexDirection === 'row-reverse' || style.flexDirection === 'column-reverse';
  const wrapEnabled = style.flexWrap === 'wrap' || style.flexWrap === 'wrap-reverse';
  const wrapReverse = style.flexWrap === 'wrap-reverse';

  const availableMain = isRow ? contentWidth : (availableHeight ?? Infinity);
  const containerCross = isRow ? availableHeight : contentWidth;

  const mainGap = gapLen(isRow ? style.columnGap : style.rowGap, isRow ? contentWidth : (availableHeight ?? 0), viewport);
  const crossGap = gapLen(isRow ? style.rowGap : style.columnGap, isRow ? (availableHeight ?? 0) : contentWidth, viewport);

  const items = collectFlexItems(el, style, styles);
  if (items.length === 0) return { children: [], height: 0 };

  // --- 1. per-item main-axis geometry ---
  for (const item of items) {
    const s = item.style;
    const mainLen = isRow ? s.width : s.height;
    const mainMinLen = isRow ? s.minWidth : s.minHeight;
    const mainMaxLen = isRow ? s.maxWidth : s.maxHeight;

    item.padBorderMain = isRow ? padInline(s, contentWidth) : padBlock(s, contentWidth);
    item.padBorderCross = isRow ? padBlock(s, contentWidth) : padInline(s, contentWidth);

    const margin = s.margin;
    const mLeft = resolveLength(margin.left, contentWidth, viewport) ?? 0;
    const mRight = resolveLength(margin.right, contentWidth, viewport) ?? 0;
    const mTop = resolveLength(margin.top, contentWidth, viewport) ?? 0;
    const mBottom = resolveLength(margin.bottom, contentWidth, viewport) ?? 0;
    item.mainStart = isRow ? (mainReverse ? mRight : mLeft) : (mainReverse ? mBottom : mTop);
    item.mainEnd = isRow ? (mainReverse ? mLeft : mRight) : (mainReverse ? mTop : mBottom);
    item.crossStart = isRow ? (wrapReverse ? mBottom : mTop) : (wrapReverse ? mRight : mLeft);
    item.crossEnd = isRow ? (wrapReverse ? mTop : mBottom) : (wrapReverse ? mLeft : mRight);
    item.mainStartAuto = isRow ? (mainReverse ? margin.right.auto : margin.left.auto) : (mainReverse ? margin.bottom.auto : margin.top.auto);
    item.mainEndAuto = isRow ? (mainReverse ? margin.left.auto : margin.right.auto) : (mainReverse ? margin.top.auto : margin.bottom.auto);
    item.crossStartAuto = isRow ? (wrapReverse ? margin.bottom.auto : margin.top.auto) : (wrapReverse ? margin.right.auto : margin.left.auto);
    item.crossEndAuto = isRow ? (wrapReverse ? margin.top.auto : margin.bottom.auto) : (wrapReverse ? margin.left.auto : margin.right.auto);

    // flex base size (border-box): definite flex-basis, else main-size property,
    // else content (max-content) size.
    const basis = s.flexBasis;
    let base: number | null = null;
    if (!basis.auto) {
      if (basis.px !== null) {
        base = s.boxSizing === 'border-box' ? basis.px : basis.px + item.padBorderMain;
      } else if (basis.pct !== null && Number.isFinite(availableMain)) {
        const v = (basis.pct / 100) * availableMain;
        base = s.boxSizing === 'border-box' ? v : v + item.padBorderMain;
      }
    }
    if (base === null) {
      const mainSpec = resolveMainLen(mainLen, availableMain);
      if (mainSpec !== null) {
        base = s.boxSizing === 'border-box' ? mainSpec : mainSpec + item.padBorderMain;
      } else {
        base = contentBasedMainSize(item, style, styles, isRow, containerCross);
      }
    }
    item.flexBaseSize = base;

    // min/max main sizes (border-box). min-width/height: auto → content-based
    // minimum in the main axis (0 for scroll containers).
    if (!mainMinLen.auto) {
      item.minMainSize = lengthToBorderBox(mainMinLen, availableMain, s, item.padBorderMain) ?? 0;
    } else {
      item.minMainSize =
        s.overflow !== 'visible' ? 0 : contentBasedMinMainSize(item, styles, isRow);
    }
    item.maxMainSize = mainMaxLen.auto
      ? Infinity
      : lengthToBorderBox(mainMaxLen, availableMain, s, item.padBorderMain) ?? Infinity;

    item.hypotheticalMainSize = clamp(item.flexBaseSize, item.minMainSize, item.maxMainSize);
  }

  // --- 2. collect items into flex lines ---
  const lines: FlexLine[] = [];
  if (!wrapEnabled) {
    lines.push({ items, crossSize: 0, crossStart: 0, baseline: 0 });
  } else {
    let cur: FlexItem[] = [];
    let used = 0;
    for (const item of items) {
      const outer = item.hypotheticalMainSize + item.mainStart + item.mainEnd;
      if (cur.length > 0 && used + mainGap + outer > availableMain + EPS) {
        lines.push({ items: cur, crossSize: 0, crossStart: 0, baseline: 0 });
        cur = [item];
        used = outer;
      } else {
        used += cur.length > 0 ? mainGap + outer : outer;
        cur.push(item);
      }
    }
    if (cur.length > 0) lines.push({ items: cur, crossSize: 0, crossStart: 0, baseline: 0 });
  }

  // --- 3. resolve flexible lengths per line ---
  for (const line of lines) {
    resolveFlexibleLengths(line, availableMain, mainGap);
  }

  // --- container main size for placement (indefinite → computed) ---
  let placeMain = availableMain;
  if (!Number.isFinite(placeMain)) {
    placeMain = 0;
    for (const line of lines) {
      let s = 0;
      for (const item of line.items) s += item.mainStart + item.usedMainSize + item.mainEnd;
      s += mainGap * (line.items.length - 1);
      placeMain = Math.max(placeMain, s);
    }
  }

  // --- 4. hypothetical cross size per item at the used main size ---
  for (const item of items) {
    const s = item.style;
    const crossLen = isRow ? s.height : s.width;
    const crossMinLen = isRow ? s.minHeight : s.minWidth;
    const crossMaxLen = isRow ? s.maxHeight : s.maxWidth;
    item.crossDefinite = crossDefiniteOf(crossLen, containerCross);
    if (item.crossDefinite) {
      item.hypotheticalCrossSize = crossBorderBox(crossLen, containerCross!, s, item.padBorderCross) ?? 0;
    } else if (isRow) {
      const mainContentW = Math.max(0, item.usedMainSize - item.padBorderMain);
      item.hypotheticalCrossSize =
        contentBlockHeight(item.el, s, styles, mainContentW) + item.padBorderCross;
    } else {
      item.hypotheticalCrossSize = contentInlineSizes(item.el, s, styles).max + item.padBorderCross;
    }
    if (!crossMinLen.auto) {
      item.minCrossSize = lengthToBorderBox(crossMinLen, containerCross ?? 0, s, item.padBorderCross) ?? 0;
    } else {
      item.minCrossSize = 0;
    }
    item.maxCrossSize = crossMaxLen.auto
      ? Infinity
      : lengthToBorderBox(crossMaxLen, containerCross ?? 0, s, item.padBorderCross) ?? Infinity;
  }

  // --- 5. line cross sizes + align-content distribution ---
  // Baseline info first: for row-direction lines with baseline-aligned items,
  // the line baseline is the max item baseline offset and the line cross grows
  // to accommodate the lowest baseline-aligned item's bottom edge.
  const baselinePerItem = new Map<FlexItem, number>();
  const isBaselineItem = new Map<FlexItem, boolean>();
  if (isRow) {
    for (const item of items) {
      isBaselineItem.set(item, effectiveAlign(item, style, containerCross) === 'baseline');
      if (isBaselineItem.get(item)) {
        baselinePerItem.set(item, baselineFromMarginBoxTop(item, styles, item.hypotheticalCrossSize));
      }
    }
  }
  const alignContent = style.alignContent === 'normal' || style.alignContent === 'stretch' ? 'stretch' : style.alignContent;
  let crossExtent: number;
  if (lines.length === 1 && containerCross !== null) {
    lines[0].crossSize = containerCross;
    crossExtent = containerCross;
  } else {
    for (const line of lines) {
      let max = 0;
      let anyBaseline = false;
      let lineBaseline = -Infinity;
      for (const item of line.items) {
        max = Math.max(max, item.hypotheticalCrossSize);
        if (isBaselineItem.get(item)) {
          anyBaseline = true;
          lineBaseline = Math.max(lineBaseline, baselinePerItem.get(item)!);
        }
      }
      line.baseline = anyBaseline ? lineBaseline : 0;
      if (anyBaseline) {
        for (const item of line.items) {
          const bi = baselinePerItem.get(item);
          const extent = bi !== undefined ? lineBaseline - bi + item.hypotheticalCrossSize : item.hypotheticalCrossSize;
          max = Math.max(max, extent);
        }
      }
      line.crossSize = max;
    }
    if (containerCross !== null) {
      const total = lines.reduce((a, l) => a + l.crossSize, 0) + crossGap * (lines.length - 1);
      const leftover = containerCross - total;
      if (leftover > EPS) {
        const n = lines.length;
        let extra = 0;
        let leading = 0;
        let gutter = crossGap;
        switch (alignContent) {
          case 'stretch':
            extra = leftover / n;
            break;
          case 'space-between':
            gutter = n > 1 ? crossGap + leftover / (n - 1) : crossGap;
            break;
          case 'space-around':
            leading = leftover / (2 * n);
            gutter = crossGap + leftover / n;
            break;
          case 'space-evenly':
            leading = leftover / (n + 1);
            gutter = crossGap + leftover / (n + 1);
            break;
          case 'end':
            leading = leftover;
            break;
          case 'center':
            leading = leftover / 2;
            break;
          default:
            break;
        }
        let y = leading;
        for (const line of lines) {
          line.crossStart = y;
          y += line.crossSize + extra + gutter;
        }
      } else {
        placeLines(lines, crossGap);
      }
      crossExtent = containerCross;
    } else {
      placeLines(lines, crossGap);
      crossExtent = 0;
      for (const line of lines) crossExtent = Math.max(crossExtent, line.crossStart + line.crossSize);
    }
  }
  // wrap-reverse packs lines from the cross end: mirror every line position.
  if (wrapReverse) {
    for (const line of lines) {
      line.crossStart = crossExtent - (line.crossStart + line.crossSize);
    }
  }

  // --- 6. used cross size per item ---
  for (const line of lines) {
    for (const item of line.items) {
      const align = effectiveAlign(item, style, containerCross);
      let used: number;
      if (item.crossDefinite) {
        used = item.hypotheticalCrossSize;
      } else if (
        align === 'stretch' &&
        !item.crossStartAuto &&
        !item.crossEndAuto &&
        line.crossSize - item.crossStart - item.crossEnd > EPS
      ) {
        used = line.crossSize - item.crossStart - item.crossEnd;
      } else {
        used = item.hypotheticalCrossSize;
      }
      item.usedCrossSize = clamp(used, item.minCrossSize, item.maxCrossSize);
    }
  }

  // --- 7. place items ---
  const mainStartOrigin = isRow ? contentX : contentY;
  const mainEndOrigin = mainStartOrigin + placeMain;
  for (const line of lines) {
    const lineCrossEnd = line.crossStart + line.crossSize;
    // main-axis placement with justify-content / auto margins
    const n = line.items.length;
    let sumOuter = 0;
    for (const item of line.items) {
      sumOuter += item.mainStart + item.usedMainSize + item.mainEnd;
    }
    let free = placeMain - sumOuter - mainGap * (n - 1);
    let autoCount = 0;
    for (const item of line.items) {
      if (item.mainStartAuto) autoCount++;
      if (item.mainEndAuto) autoCount++;
    }
    const jc = style.justifyContent;
    const justify = jc === 'normal' || jc === 'stretch' ? 'start' : jc;
    let leading = 0;
    let gapAdj = mainGap;
    if (free > EPS && autoCount > 0) {
      const share = free / autoCount;
      for (const item of line.items) {
        if (item.mainStartAuto) item.mainStart = share;
        if (item.mainEndAuto) item.mainEnd = share;
      }
    } else if (autoCount === 0) {
      switch (justify) {
        case 'end':
          leading = free;
          break;
        case 'center':
          leading = free / 2;
          break;
        case 'space-between':
          if (free > EPS && n > 1) gapAdj = mainGap + free / (n - 1);
          break;
        case 'space-around':
          if (free > EPS) {
            leading = free / (2 * n);
            gapAdj = mainGap + free / n;
          }
          break;
        case 'space-evenly':
          if (free > EPS) {
            leading = free / (n + 1);
            gapAdj = mainGap + free / (n + 1);
          }
          break;
        default:
          break;
      }
    }
    let rel = leading;
    for (const item of line.items) {
      item.mainPos = mainReverse
        ? mainEndOrigin - rel - item.usedMainSize - item.mainStart
        : mainStartOrigin + rel + item.mainStart;
      rel += item.mainStart + item.usedMainSize + item.mainEnd + gapAdj;
    }
    // cross-axis alignment per item
    for (const item of line.items) {
      const align = effectiveAlign(item, style, containerCross);
      const freeCross = line.crossSize - item.usedCrossSize - item.crossStart - item.crossEnd;
      let crossPos: number;
      if (item.crossStartAuto || item.crossEndAuto) {
        const count = (item.crossStartAuto ? 1 : 0) + (item.crossEndAuto ? 1 : 0);
        const share = freeCross > EPS ? freeCross / count : 0;
        crossPos = line.crossStart + item.crossStart + (item.crossStartAuto ? share : 0);
      } else if (align === 'baseline' && isRow && line.baseline > 0) {
        crossPos = line.crossStart + line.baseline - (baselinePerItem.get(item) ?? 0) + item.crossStart;
      } else if (align === 'center') {
        crossPos = line.crossStart + item.crossStart + freeCross / 2;
      } else if (align === 'end') {
        crossPos = lineCrossEnd - item.crossStart - item.crossEnd - item.usedCrossSize + item.crossStart;
      } else {
        crossPos = line.crossStart + item.crossStart;
      }
      if (isRow) {
        item.borderX = item.mainPos;
        item.borderY = contentY + crossPos;
      } else {
        item.borderX = contentX + crossPos;
        item.borderY = item.mainPos;
      }
    }
  }

  // --- 9. lay out each item through the block machinery ---
  const children: LayoutNode[] = [];
  for (const item of items) {
    const s = item.style;
    const bL = s.borderWidth.left;
    const bT = s.borderWidth.top;
    const padL = resolveLength(s.padding.left, contentWidth, viewport) ?? 0;
    const padT = resolveLength(s.padding.top, contentWidth, viewport) ?? 0;
    const borderW = isRow ? item.usedMainSize : item.usedCrossSize;
    const borderH = isRow ? item.usedCrossSize : item.usedMainSize;
    const fm = new FloatManager(contentX, contentWidth);
    const node = layoutElementBox(
      item.el,
      s,
      fm,
      item.borderX,
      item.borderY,
      borderW,
      item.borderX + bL + padL,
      item.borderY + bT + padT,
      Math.max(0, borderW - item.padBorderMain),
      styles,
      paints,
      nextOrder,
      undefined,
      borderH,
    );
    children.push(node);
  }

  // --- 10. container cross size (contentHeight) ---
  let height: number;
  if (isRow) {
    if (containerCross !== null) {
      height = containerCross;
    } else {
      let maxBottom = 0;
      for (const line of lines) {
        maxBottom = Math.max(maxBottom, line.crossStart + line.crossSize);
      }
      height = maxBottom;
    }
  } else {
    height = placeMain;
  }

  return { children, height };
}

function gapLen(l: Length, ref: number, viewport?: Viewport): number {
  if (l.auto) return 0;
  const v = resolveLength(l, ref, viewport);
  return v === null ? 0 : v;
}

function resolveMainLen(l: Length, availableMain: number): number | null {
  if (l.auto) return null;
  if (l.px !== null) return l.px;
  if (l.pct !== null && Number.isFinite(availableMain)) return (l.pct / 100) * availableMain;
  return null;
}

/** Convert a length to a border-box size against the main axis ref. */
function lengthToBorderBox(l: Length, ref: number, s: ComputedStyle, padBorder: number): number | null {
  const v = resolveMainLen(l, ref);
  if (v === null) return null;
  return s.boxSizing === 'border-box' ? v : v + padBorder;
}

function crossDefiniteOf(l: Length, containerCross: number | null): boolean {
  if (l.auto) return false;
  if (l.px !== null) return true;
  if (l.pct !== null) return containerCross !== null;
  return false;
}

function crossBorderBox(l: Length, containerCross: number, s: ComputedStyle, padBorder: number): number | null {
  let v: number | null = null;
  if (l.px !== null) v = l.px;
  else if (l.pct !== null) v = (l.pct / 100) * containerCross;
  if (v === null) return null;
  return s.boxSizing === 'border-box' ? v : v + padBorder;
}

/**
 * Content-based flex base size (css-flexbox-1 §9.2.1): the max-content main
 * size. For column containers the block-axis max-content depends on the cross
 * (inline) size the item is being measured at — stretch items measure at the
 * container cross, others at their max-content inline size.
 */
function contentBasedMainSize(
  item: FlexItem,
  container: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  isRow: boolean,
  containerCross: number | null,
): number {
  const s = item.style;
  if (isRow) {
    return contentInlineSizes(item.el, s, styles).max + item.padBorderMain;
  }
  const crossLen = s.width;
  let measureW: number;
  if (crossLen.px !== null) {
    measureW = s.boxSizing === 'border-box' ? crossLen.px : crossLen.px + item.padBorderCross;
  } else {
    const align = s.alignSelf ?? container.alignItems;
    const stretch = align === 'stretch';
    if (stretch && containerCross !== null) {
      measureW = containerCross;
    } else {
      measureW = contentInlineSizes(item.el, s, styles).max + item.padBorderCross;
    }
  }
  const contentBoxW = Math.max(0, measureW - item.padBorderCross);
  return contentBlockHeight(item.el, s, styles, contentBoxW) + item.padBorderMain;
}

/** Content-based minimum main size (min-width/height: auto) for a flex item. */
function contentBasedMinMainSize(
  item: FlexItem,
  styles: Map<P5Element, ComputedStyle>,
  isRow: boolean,
): number {
  const s = item.style;
  if (isRow) {
    return contentInlineSizes(item.el, s, styles).min + item.padBorderMain;
  }
  return item.padBorderMain;
}

function effectiveAlign(item: FlexItem, container: ComputedStyle, containerCross: number | null): string {
  const as = item.style.alignSelf ?? container.alignItems;
  if (as === 'baseline') return 'baseline';
  if (as === 'stretch' && item.crossDefinite) return 'start';
  return as;
}

/** Baseline offset from the margin-box top (css-flexbox-1 §8.3.1). */
function baselineFromMarginBoxTop(
  item: FlexItem,
  styles: Map<P5Element, ComputedStyle>,
  crossSize: number,
): number {
  const s = item.style;
  const marginTop = item.crossStart;
  if (hasInlineText(item.el, styles)) {
    const padTop = (resolveLength(s.padding.top, 0) ?? 0) + s.borderWidth.top;
    const lineBaseline = textBaselineOffset(s.fontSize, s.lineHeight);
    return marginTop + padTop + lineBaseline;
  }
  return marginTop + crossSize + item.crossEnd;
}

function placeLines(lines: FlexLine[], crossGap: number): void {
  let y = 0;
  for (const line of lines) {
    line.crossStart = y;
    y += line.crossSize + crossGap;
  }
}

/** Per-item flex factor used when distributing space (§9.7c: shrink scales by base). */
function flexFactor(item: FlexItem, growCase: boolean): number {
  return growCase ? item.flexGrow : item.flexShrink * item.flexBaseSize;
}

/**
 * css-flexbox-1 §9.7 Resolving Flexible Lengths, per line. Free space is
 * recomputed each iteration (frozen items contribute their target size,
 * unfrozen items their flex base size); when the sum of the unfrozen flex
 * factors is less than one and free space is positive, it is scaled down.
 */
function resolveFlexibleLengths(line: FlexLine, availableMain: number, mainGap: number): void {
  const items = line.items;
  const n = items.length;
  if (!Number.isFinite(availableMain)) {
    for (const item of items) item.usedMainSize = item.hypotheticalMainSize;
    return;
  }

  let sumHypo = 0;
  for (const item of items) {
    sumHypo += item.mainStart + item.hypotheticalMainSize + item.mainEnd;
  }
  sumHypo += mainGap * (n - 1);
  const growCase = sumHypo <= availableMain + EPS;

  for (const item of items) {
    item.frozen = false;
    item.targetMainSize = item.hypotheticalMainSize;
    const factor = flexFactor(item, growCase);
    if (factor <= 0) item.frozen = true;
  }

  for (;;) {
    let sumFactors = 0;
    for (const item of items) {
      if (item.frozen) continue;
      const factor = flexFactor(item, growCase);
      if (factor > 0) sumFactors += factor;
    }
    if (sumFactors <= 0) break;

    // recompute remaining free space
    let remaining = availableMain - mainGap * (n - 1);
    for (const item of items) {
      const size = item.frozen ? item.targetMainSize : item.flexBaseSize;
      remaining -= item.mainStart + size + item.mainEnd;
    }
    if (remaining > EPS && sumFactors < 1) remaining *= sumFactors;
    if (Math.abs(remaining) <= EPS) break;

    for (const item of items) {
      if (item.frozen) continue;
      const factor = flexFactor(item, growCase);
      item.targetMainSize = item.flexBaseSize + (remaining * factor) / sumFactors;
    }

    // clamp + collect violations
    let clampedUp = 0;
    let clampedDown = 0;
    const upItems: FlexItem[] = [];
    const downItems: FlexItem[] = [];
    for (const item of items) {
      if (item.frozen) continue;
      const t = item.targetMainSize;
      const c = clamp(t, item.minMainSize, item.maxMainSize);
      item.targetMainSize = c;
      if (c > t + EPS) {
        upItems.push(item);
        clampedUp += c - t;
      } else if (c < t - EPS) {
        downItems.push(item);
        clampedDown += c - t;
      }
    }
    if (clampedUp === 0 && clampedDown === 0) break;
    if (clampedUp >= -clampedDown) {
      for (const item of upItems) item.frozen = true;
    } else {
      for (const item of downItems) item.frozen = true;
    }
  }

  for (const item of items) {
    item.usedMainSize = item.targetMainSize;
  }
}
