/**
 * Shared content-intrinsic sizing (QA-02): the min/max inline-content helpers
 * were quadruplicated across flexbox/grid/tables/block-inline with real drift
 * (display-skip set, absolute/fixed skip, border-box handling, collapsed-space
 * measurement, break capping). Each caller's exact behavior is preserved via a
 * policy object; the five drift axes are the policy knobs below.
 */

import {
  applyTextTransform,
  borderPaddingInline,
  clamp,
  resolveLength,
  type ComputedStyle,
  type Length,
  type Viewport,
  type WhiteSpaceValue,
} from './css.js';
import { measureTextWidth, minTextWidth } from './measure.js';
import { buildPieces, expandContents, type InlinePiece } from './block-inline.js';
import { isElementNode, isTextNode, type P5Element } from './types.js';

/** The two intrinsic-sizing drift axes inside the piece machinery. */
export interface PieceSizingPolicy {
  /** collapsed/preserved-space measurement style: the box's own (tables) vs the space piece's run style (block-inline). */
  spaceStyle: 'single' | 'piece';
  /** max-content break handling: cap at the widest line (tables) vs ignore breaks entirely (block-inline). */
  breaks: 'cap' | 'skip';
}

export interface IntrinsicPolicy extends PieceSizingPolicy {
  /** display values the inline-text walkers treat as block-level and skip (grid also skips `table`). */
  blockDisplays: ReadonlySet<string>;
  /** skip position:absolute/fixed children (flexbox/tables; grid does not). */
  skipPositioned: boolean;
  /** skip floated children (tables only). */
  skipFloat: boolean;
  /** measure inline text through the piece machinery (tables) instead of the collapsed-text walkers. */
  pieceText: boolean;
  /** a row flex container sums item contributions + gaps; otherwise the widest child wins. */
  rowFlex: boolean;
  /** add each child's margins and border/padding to its contribution (tables). */
  childMargins: boolean;
  /** displays whose children contribute; unset = every element child contributes (tables whitelists block-level displays). */
  childDisplays?: ReadonlySet<string>;
  /** width contribution of nested display:table children (tables). */
  nestedTableWidth?: (
    el: P5Element,
    style: ComputedStyle,
    styles: Map<P5Element, ComputedStyle>,
    viewport: Viewport | undefined,
  ) => number;
  /** convert specified widths and min/max bounds to border-box when clamping contributions (flexbox). */
  borderBox: boolean;
}

type RunStyle = Extract<InlinePiece, { kind: 'space' }>['style'];

/** True when any inline-level content (text or inline element) is present. */
export function hasInlineText(
  el: P5Element,
  styles: Map<P5Element, ComputedStyle>,
  blockDisplays: ReadonlySet<string>,
): boolean {
  for (const child of expandContents(el.childNodes, styles)) {
    if (isTextNode(child)) {
      if (/\S/.test(child.value)) return true;
    } else if (isElementNode(child)) {
      const s = styles.get(child);
      if (s && blockDisplays.has(s.display)) continue;
      return true;
    }
  }
  return false;
}

/** Concatenate inline-level text, applying the box's text-transform. */
export function collectInlineText(
  el: P5Element,
  styles: Map<P5Element, ComputedStyle>,
  blockDisplays: ReadonlySet<string>,
): string {
  let out = '';
  const self = styles.get(el);
  const transform = self?.textTransform ?? 'none';
  for (const child of expandContents(el.childNodes, styles)) {
    if (isTextNode(child)) {
      out += applyTextTransform(child.value, transform);
    } else if (isElementNode(child)) {
      const s = styles.get(child);
      if (s && blockDisplays.has(s.display)) continue;
      out += collectInlineText(child, styles, blockDisplays);
    }
  }
  return out;
}

function textContentSizes(text: string, style: ComputedStyle): { min: number; max: number } {
  const widest = minTextWidth(text, style.fontSize, style.fontFamily, style.letterSpacing, style.overflowWrap === 'anywhere');
  const ws = resolveLength(style.wordSpacing, 0) ?? 0;
  const full = measureTextWidth(text, style.fontSize, style.fontFamily, style.letterSpacing) + ws * (text.match(/ /g)?.length ?? 0);
  return { min: widest, max: full };
}

/**
 * Min/max width of inline pieces. The two former implementations split on
 * exactly these two knobs: tables measured collapsed spaces with the box's own
 * style and capped max at the widest line, block-inline measured them with the
 * space's run style and skipped breaks.
 */
export function pieceContentSizes(
  pieces: InlinePiece[],
  style: ComputedStyle,
  ws: WhiteSpaceValue,
  wordSpacing: number,
  policy: PieceSizingPolicy,
): { min: number; max: number } {
  const preserve = ws === 'pre' || ws === 'pre-wrap';
  let min = 0;
  let max = 0;
  let lineMax = 0;
  let prevWasSpace = false;
  let prevSpaceStyle: RunStyle | null = null;
  const singleSpaceW = measureTextWidth(' ', style.fontSize, style.fontFamily, style.letterSpacing) + wordSpacing;
  const add = (w: number): void => {
    if (policy.breaks === 'cap') lineMax += w;
    else max += w;
  };
  for (const p of pieces) {
    if (p.kind === 'break') {
      // 'cap' keeps the widest line: a forced break (<br>) ends a max-content
      // line, so the max is the widest LINE, not the sum of all words. 'skip'
      // treats breaks as invisible and keeps the running total.
      if (policy.breaks === 'cap') {
        max = Math.max(max, lineMax);
        lineMax = 0;
        prevWasSpace = false;
        prevSpaceStyle = null;
      }
      continue;
    }
    if (p.kind === 'wbr') continue;
    if (p.kind === 'space') {
      if (preserve) {
        add(
          policy.spaceStyle === 'single'
            ? measureTextWidth(p.text, style.fontSize, style.fontFamily, style.letterSpacing) + wordSpacing * p.text.length
            : measureTextWidth(p.text, p.style.fontSize, p.style.family, p.style.letterSpacing, p.style.fontWeight, p.style.fontStyle) +
                wordSpacing * p.text.length,
        );
      }
      prevWasSpace = true;
      prevSpaceStyle = p.style;
      continue;
    }
    const w =
      p.kind === 'word'
        ? measureTextWidth(p.text, p.style.fontSize, p.style.family, p.style.letterSpacing, p.style.fontWeight, p.style.fontStyle)
        : p.marginLeft + p.borderWidth + p.marginRight;
    min = Math.max(
      min,
      p.kind === 'word'
        ? minTextWidth(p.text, p.style.fontSize, p.style.family, p.style.letterSpacing, style.overflowWrap === 'anywhere', p.style.fontWeight, p.style.fontStyle)
        : w,
    );
    if (prevWasSpace && !preserve) {
      add(
        policy.spaceStyle === 'single'
          ? singleSpaceW
          : // A collapsed inter-word space is measured with the space's own
            // style — the text node it came from — so a space before a
            // font-size-changing element keeps the preceding run's advance (Chrome).
            measureTextWidth(' ', prevSpaceStyle!.fontSize, prevSpaceStyle!.family, prevSpaceStyle!.letterSpacing, prevSpaceStyle!.fontWeight, prevSpaceStyle!.fontStyle) +
              wordSpacing,
      );
    }
    add(w);
    prevWasSpace = false;
    prevSpaceStyle = null;
  }
  return { min, max: policy.breaks === 'cap' ? Math.max(max, lineMax) : max };
}

/** Min/max inline contribution of one box (specified width clamped by min/max, else content + border/padding). */
export function inlineContribution(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  policy: IntrinsicPolicy,
): { min: number; max: number } {
  const pb = borderPaddingInline(style, 0);
  const resolved = (len: Length): number | null => {
    if (len.auto || len.px === null) return null;
    // content-box widths contribute their border/padding as part of the box.
    return policy.borderBox && style.boxSizing !== 'border-box' ? len.px + pb : len.px;
  };
  const specW = style.width;
  if (specW.px !== null) {
    const w = resolved(specW);
    if (w !== null) {
      const lo = resolved(style.minWidth) ?? 0;
      const hi = resolved(style.maxWidth) ?? Infinity;
      return { min: clamp(w, lo, hi), max: clamp(w, lo, hi) };
    }
  }
  const content = contentInlineSizes(el, style, styles, policy);
  const lo = policy.borderBox && style.minWidth.auto ? content.min + pb : (resolved(style.minWidth) ?? 0);
  const hi = policy.borderBox && style.maxWidth.auto ? Infinity : (resolved(style.maxWidth) ?? Infinity);
  return { min: clamp(content.min + pb, lo, hi), max: clamp(content.max + pb, lo, hi) };
}

function gapLen(l: Length, ref: number, viewport?: Viewport | null): number {
  if (l.auto) return 0;
  const v = resolveLength(l, ref, viewport);
  return v === null ? 0 : v;
}

function childInlineContribution(
  child: P5Element,
  cs: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  policy: IntrinsicPolicy,
  viewport: Viewport | undefined,
  refWidth: number,
): { min: number; max: number } {
  if (!policy.childMargins) return inlineContribution(child, cs, styles, policy);
  const mL = resolveLength(cs.margin.left, refWidth, viewport) ?? 0;
  const mR = resolveLength(cs.margin.right, refWidth, viewport) ?? 0;
  const pb = borderPaddingInline(cs, refWidth, viewport);
  if (policy.nestedTableWidth && (cs.display === 'table' || cs.display === 'inline-table')) {
    const w = policy.nestedTableWidth(child, cs, styles, viewport);
    return { min: w + mL + mR, max: w + mL + mR };
  }
  if (policy.childDisplays && !policy.childDisplays.has(cs.display)) return { min: 0, max: 0 };
  const specW = cs.width.px;
  if (specW !== null) return { min: specW + pb + mL + mR, max: specW + pb + mL + mR };
  const sizes = contentInlineSizes(child, cs, styles, policy, viewport, refWidth);
  return { min: sizes.min + pb + mL + mR, max: sizes.max + pb + mL + mR };
}

/**
 * Min/max intrinsic inline size of a box's content (css-flexbox-1 §9.4,
 * css-grid-1 §7.2, css-tables-3 §3.4): inline text measured (collapsed-text or
 * piece walk), then block-level children each contributing min/max.
 */
export function contentInlineSizes(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  policy: IntrinsicPolicy,
  viewport: Viewport | undefined = undefined,
  refWidth = 0,
): { min: number; max: number } {
  let min = 0;
  let max = 0;
  if (policy.pieceText) {
    const pieces = buildPieces(el, style, styles, refWidth, viewport, style.whiteSpace);
    if (pieces.length > 0) {
      const sizes = pieceContentSizes(pieces, style, style.whiteSpace, resolveLength(style.wordSpacing, refWidth, viewport) ?? 0, policy);
      min = sizes.min;
      max = sizes.max;
    }
  } else if (hasInlineText(el, styles, policy.blockDisplays)) {
    return textContentSizes(collectInlineText(el, styles, policy.blockDisplays).replace(/[ \t\r\n\f]+/g, ' ').trim(), style);
  }
  if (policy.rowFlex && style.display === 'flex' && (style.flexDirection === 'row' || style.flexDirection === 'row-reverse')) {
    let n = 0;
    const gap = gapLen(style.columnGap, 0, undefined);
    let sumMin = 0;
    let sumMax = 0;
    for (const child of expandContents(el.childNodes, styles)) {
      if (!isElementNode(child)) continue;
      const cs = styles.get(child);
      if (!cs || cs.display === 'none') continue;
      if (policy.skipPositioned && (cs.position === 'absolute' || cs.position === 'fixed')) continue;
      if (n > 0) {
        sumMin += gap;
        sumMax += gap;
      }
      n++;
      const c = childInlineContribution(child, cs, styles, policy, viewport, refWidth);
      sumMin += c.min;
      sumMax += c.max;
    }
    return { min: sumMin, max: sumMax };
  }
  for (const child of expandContents(el.childNodes, styles)) {
    if (!isElementNode(child)) continue;
    const cs = styles.get(child);
    if (!cs || cs.display === 'none') continue;
    if (policy.skipPositioned && (cs.position === 'absolute' || cs.position === 'fixed')) continue;
    if (policy.skipFloat && cs.float !== 'none') continue;
    const c = childInlineContribution(child, cs, styles, policy, viewport, refWidth);
    min = Math.max(min, c.min);
    max = Math.max(max, c.max);
  }
  return { min, max };
}