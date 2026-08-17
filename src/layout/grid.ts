/**
 * CSS Grid layout — the last formatting algorithm in the engine.
 *
 * Implements, matching Blink's track sizing (css-grid-1 §11, mirroring
 * GridTrackSizingAlgorithm in chromium):
 *   - explicit/implicit track lists (px, %, fr, minmax, auto, min-content,
 *     max-content, fit-content, repeat())
 *   - intrinsic track sizing with spanning-item space distribution
 *   - maximize / expand-flexible / stretch-auto track steps
 *   - auto-placement (row & column flow, span, dense) per §8.5
 *   - justify/align items/self, justify/align content, gap
 *
 * The container box is established by block-inline.ts, which calls
 * `layoutGridChildren` for any element with display:grid. Each grid item is
 * then laid out through the ordinary block/inline machinery.
 */

import {
  AUTO,
  borderPaddingBlock,
  borderPaddingInline,
  clamp,
  resolveLength,
  type ComputedStyle,
  type ContentAlign,
  type GridLineSpec,
  type GridTemplate,
  type SelfAlign,
  type TrackDef,
  type TrackFunction,
  type Viewport,
} from './css.js';
import { layoutTextLines, measureTextWidth } from './measure.js';
import { FloatManager, layoutElementBox, type LayoutNode, type PaintOp } from './block-inline.js';
import { isCommentNode, isElementNode, isTextNode, type P5Element, type P5Text } from './types.js';

const EPS = 0.001;

const DEFAULT_AUTO: TrackDef = { min: { type: 'auto' }, max: { type: 'auto' }, names: [] };

function marginsInline(style: ComputedStyle, ref: number): { left: number; right: number } {
  return { left: resolveLength(style.margin.left, ref) ?? 0, right: resolveLength(style.margin.right, ref) ?? 0 };
}

function marginsBlock(style: ComputedStyle, ref: number): { top: number; bottom: number } {
  return { top: resolveLength(style.margin.top, ref) ?? 0, bottom: resolveLength(style.margin.bottom, ref) ?? 0 };
}

function resolveTrackFn(fn: TrackFunction, containerSize: number | null, viewport?: Viewport | null): number | null {
  switch (fn.type) {
    case 'fixed':
      return fn.px;
    case 'pct':
      return containerSize === null ? null : (fn.pct / 100) * containerSize;
    case 'calc':
      return resolveLength(fn.len, containerSize ?? 0, viewport);
    default:
      return null;
  }
}

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
    const m = inlineContributions(child, cs, styles);
    min = Math.max(min, m.min);
    max = Math.max(max, m.max);
  }
  return { min, max };
}

function inlineContributions(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
): { min: number; max: number; minimum: number } {
  const pb = borderPaddingInline(style, 0);
  const specW = style.width.px;
  const minW = style.minWidth.px ?? 0;
  const maxW = style.maxWidth.px ?? Infinity;
  if (specW !== null) {
    const w = clamp(specW, minW, maxW);
    return { min: w, max: w, minimum: w };
  }
  const content = contentInlineSizes(el, style, styles);
  const minC = clamp(content.min + pb, minW, maxW);
  const maxC = clamp(content.max + pb, minW, maxW);
  return { min: minC, max: maxC, minimum: minC };
}

function contentHeightAtWidth(
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
  let y = 0;
  for (const child of el.childNodes) {
    if (!isElementNode(child)) continue;
    const cs = styles.get(child);
    if (!cs || cs.display === 'none') continue;
    y += measureChildHeight(child, cs, styles, w);
  }
  return y;
}

function measureChildHeight(
  child: P5Element,
  cs: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  parentContentW: number,
): number {
  const mT = resolveLength(cs.margin.top, parentContentW) ?? 0;
  const mB = resolveLength(cs.margin.bottom, parentContentW) ?? 0;
  const mL = resolveLength(cs.margin.left, parentContentW) ?? 0;
  const mR = resolveLength(cs.margin.right, parentContentW) ?? 0;
  const borderW = Math.max(0, parentContentW - mL - mR);
  const innerW = Math.max(0, borderW - borderPaddingInline(cs, borderW));
  const pb = borderPaddingBlock(cs, borderW);
  const specH = cs.height.px;
  let h: number;
  if (specH !== null) {
    h = cs.boxSizing === 'border-box' ? specH : specH + pb;
  } else {
    h = contentHeightAtWidth(child, cs, styles, innerW) + pb;
  }
  const minH = cs.minHeight.px ?? 0;
  const maxH = cs.maxHeight.px ?? Infinity;
  return clamp(h, minH, maxH) + mT + mB;
}

/**
 * Block-axis contribution of a grid item laid out at the given grid-area width.
 * Includes the item's own top/bottom margins (Blink adds margin_sum).
 */
function blockContribution(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  width: number,
): number {
  const mT = resolveLength(style.margin.top, width) ?? 0;
  const mB = resolveLength(style.margin.bottom, width) ?? 0;
  const mL = resolveLength(style.margin.left, width) ?? 0;
  const mR = resolveLength(style.margin.right, width) ?? 0;
  const borderW = Math.max(0, width - mL - mR);
  const innerW = Math.max(0, borderW - borderPaddingInline(style, borderW));
  const pb = borderPaddingBlock(style, borderW);
  const specH = style.height.px;
  let h: number;
  if (specH !== null) {
    h = style.boxSizing === 'border-box' ? specH : specH + pb;
  } else {
    h = contentHeightAtWidth(el, style, styles, innerW) + pb;
  }
  const minH = style.minHeight.px ?? 0;
  const maxH = style.maxHeight.px ?? Infinity;
  return clamp(h, minH, maxH) + mT + mB;
}

function fitContentWidth(style: ComputedStyle, maxC: number, minC: number, available: number): number {
  return Math.min(maxC, Math.max(minC, available));
}

interface AxisResolved {
  start: number | null;
  span: number;
}

interface GridItemInfo {
  el: P5Element;
  style: ComputedStyle;
  isAnonymous: boolean;
  row: AxisResolved;
  col: AxisResolved;
}

function explicitLineCount(trackCount: number): number {
  return trackCount > 0 ? trackCount + 1 : 1;
}

function resolveLine(
  spec: GridLineSpec | null,
  isStart: boolean,
  template: GridTemplate | null,
  areas: Map<string, { rowStart: number; colStart: number; rowEnd: number; colEnd: number }>,
  axis: 'row' | 'col',
  explicitLines: number,
): number | null {
  if (!spec) return null;
  if (spec.kind === 'auto' || spec.kind === 'span') return null;
  if (spec.kind === 'integer') {
    return spec.value > 0 ? spec.value : explicitLines + spec.value + 1;
  }
  const area = areas.get(spec.value);
  if (area) {
    return isStart ? (axis === 'row' ? area.rowStart : area.colStart) : (axis === 'row' ? area.rowEnd : area.colEnd);
  }
  if (template?.lineNames) {
    for (let line = 1; line <= explicitLines; line++) {
      if (template.lineNames.get(line)?.includes(spec.value)) return line;
    }
  }
  return 1;
}

function resolveAxis(
  startSpec: GridLineSpec | null,
  endSpec: GridLineSpec | null,
  template: GridTemplate | null,
  areas: Map<string, { rowStart: number; colStart: number; rowEnd: number; colEnd: number }>,
  axis: 'row' | 'col',
  explicitLines: number,
): AxisResolved {
  const s = resolveLine(startSpec, true, template, areas, axis, explicitLines);
  const e = resolveLine(endSpec, false, template, areas, axis, explicitLines);
  const sSpan = startSpec?.kind === 'span' ? startSpec.count : null;
  const eSpan = endSpec?.kind === 'span' ? endSpec.count : null;

  if (s !== null && e !== null) {
    let a = s;
    let b = e;
    if (a > b) [a, b] = [b, a];
    if (a === b) b = a + 1;
    return { start: a, span: b - a };
  }
  if (s !== null && eSpan !== null) return { start: s, span: eSpan };
  if (e !== null && sSpan !== null) return { start: e - sSpan, span: sSpan };
  if (sSpan !== null && eSpan !== null) return { start: null, span: sSpan };
  if (s !== null) return { start: s, span: 1 };
  if (e !== null) return { start: e - 1, span: 1 };
  if (sSpan !== null) return { start: null, span: sSpan };
  return { start: null, span: 1 };
}

function collectGridItems(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
): GridItemInfo[] {
  const items: GridItemInfo[] = [];
  const templateCols = style.gridTemplateColumns;
  const templateRows = style.gridTemplateRows;
  const areas = style.gridTemplateColumns?.areasByName ?? new Map();
  const colLines = explicitLineCount(templateCols?.tracks.length ?? 0);
  const rowLines = explicitLineCount(templateRows?.tracks.length ?? 0);

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
      const anonymous: ComputedStyle = {
        ...style,
        display: 'block',
        width: AUTO,
        height: AUTO,
      };
      items.push({
        el: synthetic,
        style: anonymous,
        isAnonymous: true,
        row: { start: null, span: 1 },
        col: { start: null, span: 1 },
      });
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
    const row = resolveAxis(cs.gridRowStart, cs.gridRowEnd, templateRows, areas, 'row', rowLines);
    const col = resolveAxis(cs.gridColumnStart, cs.gridColumnEnd, templateCols, areas, 'col', colLines);
    items.push({ el: cEl, style: cs, isAnonymous: false, row, col });
  }
  flushText();
  return items;
}

interface PlacedItem {
  el: P5Element;
  style: ComputedStyle;
  isAnonymous: boolean;
  rowStart: number;
  colStart: number;
  rowSpan: number;
  colSpan: number;
}

class Occupied {
  private cells = new Set<string>();
  has(r: number, c: number): boolean {
    return this.cells.has(`${r},${c}`);
  }
  place(r: number, c: number): void {
    this.cells.add(`${r},${c}`);
  }
}

function fits(occ: Occupied, r: number, c: number, rs: number, cs: number): boolean {
  for (let rr = r; rr < r + rs; rr++) {
    for (let cc = c; cc < c + cs; cc++) {
      if (occ.has(rr, cc)) return false;
    }
  }
  return true;
}

function findCol(
  occ: Occupied,
  row: number,
  rowSpan: number,
  startCol: number,
  colSpan: number,
  numCols: number,
  extend: boolean,
): { col: number; numCols: number } {
  let cols = numCols;
  for (;;) {
    for (let c = startCol; c + colSpan <= cols; c++) {
      if (fits(occ, row, c, rowSpan, colSpan)) return { col: c, numCols: cols };
    }
    if (!extend) return { col: -1, numCols: cols };
    cols++;
  }
}

/**
 * Resolve automatic positions per css-grid-1 §8.5. `numCols`/`numRows` already
 * account for the explicit grid and definite placements; rows may grow here.
 */
function autoPlace(
  items: GridItemInfo[],
  explicitColCount: number,
  explicitRowCount: number,
  colBase: number,
  rowBase: number,
  dense: boolean,
  columnFlow: boolean,
): { placed: PlacedItem[]; numCols: number; numRows: number } {
  const occ = new Occupied();
  let numCols = Math.max(colBase + explicitColCount, 1);
  let numRows = Math.max(rowBase + explicitRowCount, 1);

  const place = (item: GridItemInfo, r: number, c: number, rs: number, cs: number) => {
    for (let rr = r; rr < r + rs; rr++) {
      for (let cc = c; cc < c + cs; cc++) occ.place(rr, cc);
    }
    numRows = Math.max(numRows, r + rs);
    numCols = Math.max(numCols, c + cs);
    return { el: item.el, style: item.style, isAnonymous: item.isAnonymous, rowStart: r, colStart: c, rowSpan: rs, colSpan: cs };
  };

  const placed: PlacedItem[] = [];

  for (const item of items) {
    if (item.row.start === null || item.col.start === null) continue;
    const r = item.row.start + rowBase - 1;
    const c = item.col.start + colBase - 1;
    placed.push(place(item, r, c, item.row.span, item.col.span));
  }

  if (!columnFlow) {
    const lastColInRow = new Map<number, number>();
    for (const item of items) {
      if (item.row.start === null || item.col.start !== null) continue;
      const r = item.row.start + rowBase - 1;
      const prev = lastColInRow.get(r) ?? -1;
      const startCol = dense ? 0 : prev + 1;
      const { col, numCols: nc } = findCol(occ, r, item.row.span, startCol, item.col.span, numCols, true);
      numCols = nc;
      placed.push(place(item, r, col, item.row.span, item.col.span));
      lastColInRow.set(r, col);
    }

    let cursorRow = 0;
    let cursorCol = 0;
    for (const item of items) {
      if (item.row.start !== null) continue;
      if (item.col.start !== null) {
        const c = item.col.start + colBase - 1;
        if (!dense && c < cursorCol) cursorRow++;
        cursorCol = c;
        if (dense) cursorRow = 0;
        while (!fits(occ, cursorRow, cursorCol, item.row.span, item.col.span)) cursorRow++;
        placed.push(place(item, cursorRow, cursorCol, item.row.span, item.col.span));
        continue;
      }
      if (dense) {
        cursorRow = 0;
        cursorCol = 0;
      }
      for (;;) {
        let found = -1;
        for (let c = cursorCol; c + item.col.span <= numCols; c++) {
          if (fits(occ, cursorRow, c, item.row.span, item.col.span)) {
            found = c;
            break;
          }
        }
        if (found !== -1) {
          placed.push(place(item, cursorRow, found, item.row.span, item.col.span));
          cursorCol = found;
          break;
        }
        cursorRow++;
        cursorCol = 0;
      }
    }
  } else {
    const lastRowInCol = new Map<number, number>();
    for (const item of items) {
      if (item.col.start === null || item.row.start !== null) continue;
      const c = item.col.start + colBase - 1;
      const prev = lastRowInCol.get(c) ?? -1;
      const startRow = dense ? 0 : prev + 1;
      let r = startRow;
      while (!fits(occ, r, c, item.row.span, item.col.span)) r++;
      placed.push(place(item, r, c, item.row.span, item.col.span));
      lastRowInCol.set(c, r);
    }

    let cursorRow = 0;
    let cursorCol = 0;
    for (const item of items) {
      if (item.col.start !== null) continue;
      if (item.row.start !== null) {
        const r = item.row.start + rowBase - 1;
        if (!dense && r < cursorRow) cursorCol++;
        cursorRow = r;
        if (dense) cursorCol = 0;
        while (!fits(occ, cursorRow, cursorCol, item.row.span, item.col.span)) cursorCol++;
        placed.push(place(item, cursorRow, cursorCol, item.row.span, item.col.span));
        continue;
      }
      if (dense) {
        cursorRow = 0;
        cursorCol = 0;
      }
      for (;;) {
        let found = -1;
        for (let r = cursorRow; r + item.row.span <= numRows; r++) {
          if (fits(occ, r, cursorCol, item.row.span, item.col.span)) {
            found = r;
            break;
          }
        }
        if (found !== -1) {
          placed.push(place(item, found, cursorCol, item.row.span, item.col.span));
          cursorRow = found;
          break;
        }
        cursorCol++;
        cursorRow = 0;
      }
    }
  }

  return { placed, numCols: Math.max(numCols, 1), numRows: Math.max(numRows, 1) };
}

interface SizingItem {
  start: number;
  span: number;
  minContribution: number;
  maxContribution: number;
  minimumContribution: number;
  spansFlex: boolean;
}

type ContributionType =
  | 'intrinsicMinimums'
  | 'contentBasedMinimums'
  | 'maxContentMinimums'
  | 'intrinsicMaximums'
  | 'maxContentMaximums';

interface TrackSet {
  index: number;
  def: TrackDef;
  baseSize: number;
  growthLimit: number;
  fitContentLimit: number | null;
  isInfinitelyGrowable: boolean;
  itemIncurredIncrease: number;
  plannedIncrease: number;
  hasIntrinsicMin: boolean;
  hasContentBasedMin: boolean;
  hasMaxContentMin: boolean;
  hasIntrinsicMax: boolean;
  hasMaxContentOrAutoMax: boolean;
  isFlex: boolean;
  flexFactor: number;
}

function buildSets(trackDefs: TrackDef[], containerSize: number | null, viewport?: Viewport | null): TrackSet[] {
  return trackDefs.map((def, index) => {
    const base = resolveTrackFn(def.min, containerSize, viewport);
    const gl = resolveTrackFn(def.max, containerSize, viewport);
    const set: TrackSet = {
      index,
      def,
      baseSize: base ?? 0,
      growthLimit: gl ?? Infinity,
      fitContentLimit: def.max.type === 'fit-content' && !def.max.limit.auto ? resolveLength(def.max.limit, containerSize ?? 0, viewport) : null,
      isInfinitelyGrowable: false,
      itemIncurredIncrease: 0,
      plannedIncrease: -1,
      hasIntrinsicMin: def.min.type === 'auto' || def.min.type === 'min-content' || def.min.type === 'max-content',
      hasContentBasedMin: def.min.type === 'min-content' || def.min.type === 'max-content',
      hasMaxContentMin: def.min.type === 'max-content',
      hasIntrinsicMax: def.max.type === 'auto' || def.max.type === 'min-content' || def.max.type === 'max-content' || def.max.type === 'fit-content',
      // fit-content() maxes are treated as max-content for intrinsic max sizing
      // (spec §11.5), so they also receive max-content contributions.
      hasMaxContentOrAutoMax: def.max.type === 'max-content' || def.max.type === 'auto' || def.max.type === 'fit-content',
      isFlex: def.max.type === 'flex',
      flexFactor: def.max.type === 'flex' ? def.max.flex : 0,
    };
    if (set.growthLimit !== Infinity && set.growthLimit < set.baseSize) set.growthLimit = set.baseSize;
    return set;
  });
}

function definiteGrowthLimit(s: TrackSet): number {
  return s.growthLimit === Infinity ? s.baseSize : s.growthLimit;
}

function affectedSize(s: TrackSet, type: ContributionType): number {
  return affectsBase(type) ? s.baseSize : definiteGrowthLimit(s);
}

function affectsBase(type: ContributionType): boolean {
  return type === 'intrinsicMinimums' || type === 'contentBasedMinimums' || type === 'maxContentMinimums';
}

function contributionFor(item: SizingItem, type: ContributionType): number {
  switch (type) {
    case 'intrinsicMinimums':
      return item.minimumContribution;
    case 'contentBasedMinimums':
    case 'intrinsicMaximums':
      return item.minContribution;
    case 'maxContentMinimums':
    case 'maxContentMaximums':
      return item.maxContribution;
  }
}

function isContributionApplied(s: TrackSet, type: ContributionType): boolean {
  switch (type) {
    case 'intrinsicMinimums':
      return s.hasIntrinsicMin;
    case 'contentBasedMinimums':
      return s.hasContentBasedMin;
    case 'maxContentMinimums':
      return s.hasMaxContentMin;
    case 'intrinsicMaximums':
      return s.hasIntrinsicMax;
    case 'maxContentMaximums':
      return s.hasMaxContentOrAutoMax;
  }
}

function shouldGrowBeyondLimit(s: TrackSet, type: ContributionType): boolean {
  switch (type) {
    case 'intrinsicMinimums':
    case 'contentBasedMinimums':
      return s.hasIntrinsicMax;
    case 'maxContentMinimums':
      return s.hasMaxContentOrAutoMax;
    default:
      return false;
  }
}

/** Equal distribution with freezing at each set's limit (spec §11.5.1). */
function distributeWithLimits(
  extraSpace: number,
  sets: TrackSet[],
  potentialFn: (s: TrackSet) => number,
): Map<number, number> {
  const result = new Map<number, number>();
  let remaining = extraSpace;
  let active = sets.filter((s) => potentialFn(s) > EPS);
  while (remaining > EPS && active.length > 0) {
    const share = remaining / active.length;
    let nextRemaining = 0;
    const nextActive: TrackSet[] = [];
    for (const s of active) {
      const pot = potentialFn(s);
      const inc = Math.min(share, pot);
      result.set(s.index, (result.get(s.index) ?? 0) + inc);
      if (inc < share - EPS) nextRemaining += share - inc;
      else nextActive.push(s);
    }
    remaining = nextRemaining;
    active = nextActive;
  }
  return result;
}

function distributeEqual(
  extraSpace: number,
  sets: TrackSet[],
  type: ContributionType,
): Map<number, number> {
  const base = affectsBase(type);
  const limitPotential = (s: TrackSet): number => {
    if (base) {
      let limit = s.growthLimit;
      if (s.fitContentLimit !== null) limit = Math.min(limit, s.fitContentLimit);
      if (limit === Infinity) return Infinity;
      return Math.max(0, limit - s.baseSize);
    }
    if (!s.isInfinitelyGrowable && s.growthLimit !== Infinity) return 0;
    if (s.fitContentLimit !== null) {
      return Math.max(0, s.fitContentLimit - definiteGrowthLimit(s) - s.itemIncurredIncrease);
    }
    return Infinity;
  };
  return distributeWithLimits(extraSpace, sets, limitPotential);
}

/** Weighted distribution among flexible tracks (spec §11.5, flex ratios). */
function distributeWeighted(
  extraSpace: number,
  flexFactorSum: number,
  sets: TrackSet[],
): Map<number, number> {
  const result = new Map<number, number>();
  const flexSets = sets.filter((s) => s.flexFactor > 0);
  if (flexSets.length === 0) return result;
  let weightedSpace = extraSpace;
  let rest = 0;
  if (flexFactorSum < 1) {
    weightedSpace = extraSpace * flexFactorSum;
    rest = extraSpace - weightedSpace;
  }
  for (const s of flexSets) {
    const inc = weightedSpace * (s.flexFactor / Math.max(flexFactorSum, 1));
    result.set(s.index, (result.get(s.index) ?? 0) + inc);
  }
  if (rest > 0) {
    const each = rest / flexSets.length;
    for (const s of flexSets) result.set(s.index, (result.get(s.index) ?? 0) + each);
  }
  return result;
}

function growAffectedSize(s: TrackSet, type: ContributionType, inc: number): void {
  if (affectsBase(type)) {
    s.baseSize += inc;
    return;
  }
  if (type === 'intrinsicMaximums') {
    s.isInfinitelyGrowable = s.growthLimit === Infinity;
    s.growthLimit = definiteGrowthLimit(s) + inc;
  } else {
    s.growthLimit = definiteGrowthLimit(s) + inc;
  }
}

function increaseTrackSizes(
  items: SizingItem[],
  type: ContributionType,
  spansFlexGroup: boolean,
  sets: TrackSet[],
  gutterSize: number,
): void {
  for (const s of sets) s.plannedIncrease = -1;
  for (const item of items) {
    const setsToGrow: TrackSet[] = [];
    const setsBeyond: TrackSet[] = [];
    const spannedSets: TrackSet[] = [];
    let spannedSize = 0;
    for (let i = item.start; i < item.start + item.span; i++) {
      const set = sets[i];
      if (!set) continue;
      spannedSets.push(set);
      spannedSize += affectedSize(set, type);
    }
    spannedSize += gutterSize * (item.span - 1);
    let flexSum = 0;
    for (const set of spannedSets) {
      if (spansFlexGroup && !set.isFlex) continue;
      if (isContributionApplied(set, type)) {
        if (set.plannedIncrease === -1) set.plannedIncrease = 0;
        if (spansFlexGroup) flexSum += set.flexFactor;
        setsToGrow.push(set);
        if (shouldGrowBeyondLimit(set, type)) setsBeyond.push(set);
      }
    }
    if (setsToGrow.length === 0) continue;
    const extraSpace = Math.max(0, contributionFor(item, type) - spannedSize);
    if (extraSpace <= EPS) continue;
    let increases: Map<number, number>;
    if (spansFlexGroup && flexSum > 0) {
      increases = distributeWeighted(extraSpace, flexSum, setsToGrow);
    } else {
      increases = distributeEqual(extraSpace, setsToGrow, type);
      // Distribute remaining space into non-affected spanned tracks, then
      // beyond limits (spec §11.5.1 steps 2-3).
      let consumed = 0;
      for (const v of increases.values()) consumed += v;
      if (extraSpace - consumed > EPS) {
        const nonAffected = spannedSets.filter((s) => !setsToGrow.includes(s));
        const remaining = extraSpace - consumed;
        const base = affectsBase(type);
        const limitPotential = (s: TrackSet): number => {
          if (base) {
            let limit = s.growthLimit;
            if (s.fitContentLimit !== null) limit = Math.min(limit, s.fitContentLimit);
            return limit === Infinity ? Infinity : Math.max(0, limit - s.baseSize);
          }
          return 0;
        };
        const inc2 = distributeWithLimits(remaining, nonAffected, limitPotential);
        let consumed2 = 0;
        for (const v of inc2.values()) consumed2 += v;
        for (const [idx, v] of inc2) increases.set(idx, (increases.get(idx) ?? 0) + v);
        if (remaining - consumed2 > EPS && setsBeyond.length > 0) {
          const beyondPotential = (s: TrackSet): number => {
            if (s.fitContentLimit !== null) return Math.max(0, s.fitContentLimit - s.baseSize);
            return Infinity;
          };
          const inc3 = distributeWithLimits(remaining - consumed2, setsBeyond, beyondPotential);
          for (const [idx, v] of inc3) increases.set(idx, (increases.get(idx) ?? 0) + v);
        }
      }
    }
    for (const set of setsToGrow) {
      const inc = increases.get(set.index) ?? 0;
      if (inc > set.plannedIncrease) set.plannedIncrease = inc;
    }
  }
  for (const s of sets) {
    if (s.plannedIncrease >= 0) growAffectedSize(s, type, s.plannedIncrease);
  }
}

function resolveIntrinsic(sets: TrackSet[], items: SizingItem[], gutterSize: number): void {
  const nonFlex = items.filter((i) => !i.spansFlex).sort((a, b) => a.span - b.span);
  const flex = items.filter((i) => i.spansFlex);
  const types: ContributionType[] = ['intrinsicMinimums', 'contentBasedMinimums', 'maxContentMinimums', 'intrinsicMaximums', 'maxContentMaximums'];
  let idx = 0;
  while (idx < nonFlex.length) {
    const span = nonFlex[idx].span;
    let end = idx;
    while (end < nonFlex.length && nonFlex[end].span === span) end++;
    const group = nonFlex.slice(idx, end);
    for (const t of types) increaseTrackSizes(group, t, false, sets, gutterSize);
    idx = end;
  }
  if (flex.length > 0) {
    for (const t of ['intrinsicMinimums', 'contentBasedMinimums', 'maxContentMinimums'] as ContributionType[]) {
      increaseTrackSizes(flex, t, true, sets, gutterSize);
    }
  }
}

function determineFreeSpace(
  sets: TrackSet[],
  availableSize: number | null,
  gutterSize: number,
): number | null {
  if (availableSize === null) return null;
  let total = 0;
  for (const s of sets) total += s.baseSize;
  if (sets.length > 1) total += gutterSize * (sets.length - 1);
  return Math.max(0, availableSize - total);
}

function maximizeTracks(sets: TrackSet[], freeSpace: number): void {
  const incs = distributeWithLimits(freeSpace, sets, (s) =>
    s.growthLimit === Infinity ? Infinity : Math.max(0, s.growthLimit - s.baseSize),
  );
  for (const [idx, inc] of incs) sets[idx].baseSize += inc;
}

function findFrSize(sets: TrackSet[], spaceToFill: number, gutterSize: number): number {
  let leftover = spaceToFill;
  let flexSum = 0;
  const flexSets: TrackSet[] = [];
  let trackCount = 0;
  for (const s of sets) {
    trackCount++;
    if (s.isFlex && s.flexFactor !== 0) {
      flexSum += s.flexFactor;
      flexSets.push(s);
    } else {
      leftover -= s.baseSize;
    }
  }
  if (trackCount > 1) leftover -= gutterSize * (trackCount - 1);
  if (leftover < 0 || flexSets.length === 0) return 0;
  flexSets.sort((a, b) => b.baseSize * a.flexFactor - a.baseSize * b.flexFactor);
  let i = 0;
  while (leftover > 0 && i < flexSets.length) {
    flexSum = Math.max(flexSum, 1);
    let j = i;
    while (j < flexSets.length && flexSets[j].flexFactor * leftover < flexSets[j].baseSize * flexSum) {
      j++;
    }
    if (j === i) return leftover / flexSum;
    for (let k = i; k < j; k++) {
      flexSum -= flexSets[k].flexFactor;
      leftover -= flexSets[k].baseSize;
    }
    i = j;
  }
  return 0;
}

function expandFlexibleTracks(
  sets: TrackSet[],
  items: SizingItem[],
  availableSize: number | null,
  gutterSize: number,
): void {
  const freeSpace = determineFreeSpace(sets, availableSize, gutterSize);
  if (freeSpace === 0) return;
  let frSize: number;
  if (freeSpace !== null) {
    frSize = findFrSize(sets, availableSize as number, gutterSize);
  } else {
    frSize = 0;
    for (const item of items) {
      if (!item.spansFlex) continue;
      const spanned = sets.slice(item.start, item.start + item.span);
      frSize = Math.max(frSize, findFrSize(spanned, item.maxContribution, gutterSize));
    }
    for (const s of sets) {
      if (!s.isFlex) continue;
      frSize = Math.max(frSize, s.baseSize / Math.max(s.flexFactor, 1));
    }
  }
  for (const s of sets) {
    if (!s.isFlex) continue;
    const expanded = frSize * s.flexFactor;
    if (expanded > s.baseSize + EPS) s.baseSize = expanded;
  }
}

function stretchAutoTracks(
  sets: TrackSet[],
  availableSize: number | null,
  gutterSize: number,
  contentAlignment: ContentAlign,
): void {
  if (contentAlignment !== 'normal' && contentAlignment !== 'stretch') return;
  const autoSets = sets.filter((s) => s.def.max.type === 'auto');
  if (autoSets.length === 0) return;
  const freeSpace = determineFreeSpace(sets, availableSize, gutterSize);
  if (freeSpace === null || freeSpace <= 0) return;
  const incs = distributeWithLimits(freeSpace, autoSets, () => Infinity);
  for (const [idx, inc] of incs) sets[idx].baseSize += inc;
}

function computeTrackSizes(
  trackDefs: TrackDef[],
  items: SizingItem[],
  availableSize: number | null,
  gutterSize: number,
  contentAlignment: ContentAlign,
  viewport?: Viewport | null,
): number[] {
  const sets = buildSets(trackDefs, availableSize, viewport);
  if (sets.some((s) => s.hasIntrinsicMin || s.hasIntrinsicMax)) {
    resolveIntrinsic(sets, items, gutterSize);
  }
  for (const s of sets) {
    if (s.growthLimit === Infinity) s.growthLimit = s.baseSize;
  }
  const freeSpace = determineFreeSpace(sets, availableSize, gutterSize);
  if (freeSpace !== null && freeSpace > 0) {
    maximizeTracks(sets, freeSpace);
  }
  if (sets.some((s) => s.isFlex)) {
    expandFlexibleTracks(sets, items, availableSize, gutterSize);
  }
  stretchAutoTracks(sets, availableSize, gutterSize, contentAlignment);
  return sets.map((s) => Math.max(0, s.baseSize));
}

function trackOffsets(
  sizes: number[],
  gutterSize: number,
  containerSize: number | null,
  alignment: ContentAlign,
): { offsets: number[]; adjustedGutter: number } {
  const n = sizes.length;
  const total = n > 0 ? sizes.reduce((a, b) => a + b, 0) + gutterSize * (n - 1) : 0;
  let leading = 0;
  let gutter = gutterSize;
  if (containerSize !== null && n > 0) {
    const free = containerSize - total;
    switch (alignment) {
      case 'center':
        leading = free / 2;
        break;
      case 'end':
        leading = free;
        break;
      case 'space-between':
        if (free > 0 && n > 1) gutter += free / (n - 1);
        break;
      case 'space-around':
        if (free > 0) {
          leading = free / (2 * n);
          gutter += free / n;
        }
        break;
      case 'space-evenly':
        if (free > 0) {
          leading = free / (n + 1);
          gutter += free / (n + 1);
        }
        break;
      default:
        break;
    }
  }
  // offsets[i] = position of the line at the END of track i-1 (offsets[0] = grid start).
  const offsets: number[] = [leading];
  let x = leading;
  for (let i = 0; i < n; i++) {
    x += sizes[i];
    offsets.push(x);
    if (i < n - 1) x += gutter;
  }
  return { offsets, adjustedGutter: gutter };
}

function areaStart(offsets: number[], trackIndex: number, gutter: number): number {
  return offsets[trackIndex] + (trackIndex > 0 ? gutter : 0);
}

function areaSpan(offsets: number[], start: number, end: number, gutter: number): number {
  return offsets[end] - areaStart(offsets, start, gutter);
}

export interface GridLayoutInput {
  el: P5Element;
  style: ComputedStyle;
  styles: Map<P5Element, ComputedStyle>;
  contentX: number;
  contentY: number;
  contentWidth: number;
  availableHeight: number | null;
  paints: PaintOp[];
  nextOrder: () => number;
  viewport?: Viewport | null;
}

export function layoutGridChildren(input: GridLayoutInput): { children: LayoutNode[]; height: number } {
  const { el, style, styles, contentX, contentY, contentWidth, availableHeight, paints, nextOrder, viewport } = input;
  const styleRef = style;
  // Grid lines run from the inline-start edge: under RTL column 1 is the
  // rightmost track, so each item area is mirrored about the content box
  // (css-grid-1 §8.1).
  const rtl = styleRef.direction === 'rtl';

  const explicitColCount = styleRef.gridTemplateColumns?.tracks.length ?? 0;
  const explicitRowCount = styleRef.gridTemplateRows?.tracks.length ?? 0;
  const areas = styleRef.gridTemplateColumns?.areasByName ?? new Map();
  const colLines = explicitLineCount(explicitColCount);
  const rowLines = explicitLineCount(explicitRowCount);

  const items = collectGridItems(el, styleRef, styles);
  let minColLine = Infinity;
  let minRowLine = Infinity;
  let maxColLine = -Infinity;
  let maxRowLine = -Infinity;
  for (const item of items) {
    if (item.col.start !== null) {
      minColLine = Math.min(minColLine, item.col.start);
      maxColLine = Math.max(maxColLine, item.col.start + item.col.span);
    }
    if (item.row.start !== null) {
      minRowLine = Math.min(minRowLine, item.row.start);
      maxRowLine = Math.max(maxRowLine, item.row.start + item.row.span);
    }
  }
  const colBase = Number.isFinite(minColLine) ? Math.max(0, 1 - minColLine) : 0;
  const rowBase = Number.isFinite(minRowLine) ? Math.max(0, 1 - minRowLine) : 0;

  const { placed, numCols, numRows } = autoPlace(
    items,
    explicitColCount,
    explicitRowCount,
    colBase,
    rowBase,
    styleRef.gridAutoFlowDense,
    styleRef.gridAutoFlowColumn,
  );

  const colTrackDef = (i: number): TrackDef => {
    const explicitIdx = i - colBase;
    if (explicitIdx >= 0 && explicitIdx < explicitColCount && styleRef.gridTemplateColumns?.tracks[explicitIdx]) {
      return styleRef.gridTemplateColumns.tracks[explicitIdx];
    }
    return styleRef.gridAutoColumns ?? DEFAULT_AUTO;
  };
  const rowTrackDef = (i: number): TrackDef => {
    const explicitIdx = i - rowBase;
    if (explicitIdx >= 0 && explicitIdx < explicitRowCount && styleRef.gridTemplateRows?.tracks[explicitIdx]) {
      return styleRef.gridTemplateRows.tracks[explicitIdx];
    }
    return styleRef.gridAutoRows ?? DEFAULT_AUTO;
  };

  const colDefs: TrackDef[] = [];
  for (let i = 0; i < numCols; i++) colDefs.push(colTrackDef(i));
  const rowDefs: TrackDef[] = [];
  for (let i = 0; i < numRows; i++) rowDefs.push(rowTrackDef(i));

  const colGap = resolveLength(styleRef.columnGap, contentWidth) ?? 0;
  const rowGap = resolveLength(styleRef.rowGap, availableHeight ?? 0) ?? 0;

  const colItems: SizingItem[] = [];
  for (const item of placed) {
    const ic = inlineContributions(item.el, item.style, styles);
    const m = marginsInline(item.style, contentWidth);
    const spansFlex = spansFlexible(item, 'col', colDefs);
    colItems.push({
      start: item.colStart,
      span: item.colSpan,
      minContribution: ic.min + m.left + m.right,
      maxContribution: ic.max + m.left + m.right,
      minimumContribution: autoMin(item, ic, colDefs) + m.left + m.right,
      spansFlex,
    });
  }

  const colSizes = computeTrackSizes(colDefs, colItems, contentWidth, colGap, styleRef.justifyContent, viewport);
  const { offsets: colOffsets, adjustedGutter: colGutter } = trackOffsets(colSizes, colGap, contentWidth, styleRef.justifyContent);

  const rowItems: SizingItem[] = [];
  for (const item of placed) {
    const spanW = areaSpan(colOffsets, item.colStart, item.colStart + item.colSpan, colGutter);
    const js = effectiveJustify(item.style, styleRef);
    const m = marginsInline(item.style, spanW);
    const innerAreaW = Math.max(0, spanW - m.left - m.right);
    const ic = inlineContributions(item.el, item.style, styles);
    const measureW =
      js === 'stretch'
        ? spanW
        : fitContentWidth(item.style, ic.max + m.left + m.right, ic.min + m.left + m.right, innerAreaW);
    const bc = blockContribution(item.el, item.style, styles, measureW);
    const mb = marginsBlock(item.style, spanW);
    const spansFlex = spansFlexible(item, 'row', rowDefs);
    rowItems.push({
      start: item.rowStart,
      span: item.rowSpan,
      minContribution: bc + mb.top + mb.bottom,
      maxContribution: bc + mb.top + mb.bottom,
      minimumContribution: autoMinBlock(item, bc, rowDefs) + mb.top + mb.bottom,
      spansFlex,
    });
  }

  const rowSizes = computeTrackSizes(rowDefs, rowItems, availableHeight, rowGap, styleRef.alignContent, viewport);
  const { offsets: rowOffsets, adjustedGutter: rowGutter } = trackOffsets(rowSizes, rowGap, availableHeight, styleRef.alignContent);

  const contentHeight =
    availableHeight !== null
      ? availableHeight
      : rowOffsets[rowOffsets.length - 1] - rowOffsets[0];

  const children: LayoutNode[] = [];
  for (const item of placed) {
    // Mirror about the content box: the area's right edge sits where the
    // track-end line lands in LTR coordinates (the raw offset, which excludes
    // the trailing gutter that areaStart would add).
    const areaX = rtl
      ? contentX + contentWidth - colOffsets[item.colStart + item.colSpan]
      : contentX + areaStart(colOffsets, item.colStart, colGutter);
    const areaY = areaStart(rowOffsets, item.rowStart, rowGutter);
    const areaW = areaSpan(colOffsets, item.colStart, item.colStart + item.colSpan, colGutter);
    const areaH = areaSpan(rowOffsets, item.rowStart, item.rowStart + item.rowSpan, rowGutter);

    const js = effectiveJustify(item.style, styleRef);
    const as = effectiveAlign(item.style, styleRef);

    const mL = resolveLength(item.style.margin.left, areaW) ?? 0;
    const mR = resolveLength(item.style.margin.right, areaW) ?? 0;
    const mT = resolveLength(item.style.margin.top, areaW) ?? 0;
    const mB = resolveLength(item.style.margin.bottom, areaW) ?? 0;
    const innerW = Math.max(0, areaW - mL - mR);
    const innerH = Math.max(0, areaH - mT - mB);

    const specW = item.style.width.px !== null ? item.style.width.px : null;
    const ic = inlineContributions(item.el, item.style, styles);
    let borderW: number;
    if (specW !== null) {
      borderW = item.style.boxSizing === 'border-box' ? specW : specW + borderPaddingInline(item.style, innerW);
    } else if (js === 'stretch' && !item.style.margin.left.auto && !item.style.margin.right.auto) {
      borderW = innerW;
    } else {
      // fit-content sizing already yields a border-box width (ic.max/min include padding+border).
      borderW = Math.max(0, fitContentWidth(item.style, ic.max, ic.min, innerW));
    }
    borderW = Math.min(borderW, innerW + 0.001);

    const freeW = innerW - borderW;
    let ml = mL;
    let mr = mR;
    const mLoc = item.style.margin.left.auto;
    const mRac = item.style.margin.right.auto;
    if (mLoc && mRac) {
      ml = freeW / 2;
      mr = freeW / 2;
    } else if (mLoc) {
      ml = freeW;
    } else if (mRac) {
      mr = freeW;
    }
    let x = areaX + ml;
    // justify-self resolves start/end against the inline axis: under RTL start
    // is the area's right edge and end its left edge.
    if (js === 'center' && !mLoc && !mRac) x += freeW / 2;
    else if (rtl ? js === 'start' : js === 'end') {
      if (!mLoc && !mRac) x += freeW;
    }

    const specH = item.style.height.px !== null ? item.style.height.px : null;
    let borderH: number;
    if (specH !== null) {
      borderH = item.style.boxSizing === 'border-box' ? specH : specH + borderPaddingBlock(item.style, borderW);
    } else if (as === 'stretch' && !item.style.margin.top.auto && !item.style.margin.bottom.auto) {
      borderH = innerH;
    } else {
      const mBInner = { top: resolveLength(item.style.margin.top, areaW) ?? 0, bottom: resolveLength(item.style.margin.bottom, areaW) ?? 0 };
      const bc = blockContribution(item.el, item.style, styles, borderW);
      borderH = Math.max(0, bc - mBInner.top - mBInner.bottom);
    }
    borderH = Math.min(borderH, innerH + 0.001);

    const freeH = innerH - borderH;
    let mt = mT;
    let mb = mB;
    const mtAuto = item.style.margin.top.auto;
    const mbAuto = item.style.margin.bottom.auto;
    if (mtAuto && mbAuto) {
      mt = freeH / 2;
      mb = freeH / 2;
    } else if (mtAuto) {
      mt = freeH;
    } else if (mbAuto) {
      mb = freeH;
    }
    let y = areaY + mt;
    if (as === 'center' && !mtAuto && !mbAuto) y += freeH / 2;
    else if (as === 'end' && !mtAuto && !mbAuto) y += freeH;

    const bL = item.style.borderWidth.left;
    const bT = item.style.borderWidth.top;
    const padL = resolveLength(item.style.padding.left, borderW) ?? 0;
    const padT = resolveLength(item.style.padding.top, borderW) ?? 0;
    const fm = new FloatManager(contentX, contentWidth);
    const node = layoutElementBox(
      item.el,
      item.style,
      fm,
      x,
      y,
      borderW,
      x + bL + padL,
      y + bT + padT,
      Math.max(0, borderW - borderPaddingInline(item.style, borderW)),
      styles,
      paints,
      nextOrder,
      undefined,
      borderH,
    );
    children.push(node);
  }

  return { children, height: contentHeight };
}

function effectiveJustify(style: ComputedStyle, container: ComputedStyle): SelfAlign {
  return style.justifySelf ?? container.justifyItems;
}

function effectiveAlign(style: ComputedStyle, container: ComputedStyle): SelfAlign {
  return style.alignSelf ?? container.alignItems;
}

function spansFlexible(item: PlacedItem, axis: 'col' | 'row', defs: TrackDef[]): boolean {
  const start = axis === 'col' ? item.colStart : item.rowStart;
  const span = axis === 'col' ? item.colSpan : item.rowSpan;
  for (let i = start; i < start + span; i++) {
    if (defs[i]?.max.type === 'flex') return true;
  }
  return false;
}

function autoMin(
  item: PlacedItem,
  ic: { min: number; max: number },
  defs: TrackDef[],
): number {
  // Automatic minimum (§6.6): content-based only when spanning an auto-min
  // track and not spanning multiple flexible tracks.
  const spansAutoMin = spansAutoMinTrack(item, 'col', defs);
  const spansFlex = spansFlexible(item, 'col', defs);
  const apply = spansAutoMin && !(spansFlex && item.colSpan > 1);
  return apply ? ic.min : 0;
}

function autoMinBlock(item: PlacedItem, blockContribution: number, defs: TrackDef[]): number {
  const spansAutoMin = spansAutoMinTrack(item, 'row', defs);
  const spansFlex = spansFlexible(item, 'row', defs);
  const apply = spansAutoMin && !(spansFlex && item.rowSpan > 1);
  return apply ? blockContribution : 0;
}

function spansAutoMinTrack(item: PlacedItem, axis: 'col' | 'row', defs: TrackDef[]): boolean {
  const start = axis === 'col' ? item.colStart : item.rowStart;
  const span = axis === 'col' ? item.colSpan : item.rowSpan;
  for (let i = start; i < start + span; i++) {
    if (defs[i]?.min.type === 'auto') return true;
  }
  return false;
}
