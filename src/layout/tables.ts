/**
 * CSS table layout (CSS 2.1 §17, css-tables-3) — the table formatting context
 * for both border models: separate borders (the tables-layout slice) and
 * collapsed borders (css-tables-3 §4, the tables-border-collapse slice).
 *
 * Mirrors Blink's LayoutNG table algorithm
 * (third_party/blink/renderer/core/layout/table/):
 *   - anonymous box fixing per css-tables-3 §2.1 (css display:table elements
 *     wrap stray content into anonymous cell/row/row-group boxes in place,
 *     while HTML table elements hoist non-table-part children into an
 *     anonymous block above the table box — probed Blink behavior)
 *   - column assignment with the colspan cell tabulator (first free column,
 *     skipping columns occupied by rowspans from earlier rows)
 *   - auto table layout: cell min/max inline constraints (CreateCellInlineConstraint),
 *     colspan-cell distribution, and the guess-based width distribution
 *     (min/percentage/specified/max/above-max guesses)
 *   - fixed table layout: col-element + first-row cell widths through the
 *     fixed synchronize pass
 *   - row block sizing with rowspan-cell excess distribution (legacy
 *     CompareRowspanCellsInHeightDistributionOrder sort: enclosed spanners
 *     first, then lowest start row) and table specified-height growth
 *   - captions above/below the table box per caption-side, caption margins,
 *     and border-spacing on all grid edges
 *   - collapsed borders (css-tables-3 §4): `border-collapse:collapse` runs a
 *     per-edge conflict resolution over cell/row/section/column/colgroup/table
 *     borders (hidden, then width, then style rank, then source class),
 *     half-border cell insets, the table's border strut, and one border
 *     segment per grid edge painted centered on the grid line
 *
 * Cells themselves lay out through the ordinary block/inline machinery
 * (layoutElementBox), with the content box shifted for vertical-align.
 */

import {
  AUTO,
  borderPaddingBlock,
  borderPaddingInline,
  pxLength,
  resolveLength,
  ZERO_BORDER_RADIUS,
  type BorderStyleKeyword,
  type Color,
  type ComputedStyle,
  type DisplayValue,
  type Side,
  type Viewport,
} from './css.js';
import { layoutElementBox, expandContents, FloatManager, pushPaintOp, type LayoutNode, type PaintOp } from './block-inline.js';
import { contentInlineSizes, type IntrinsicPolicy } from './intrinsic.js';
import { isCommentNode, isElementNode, isTextNode, type Box, type P5Element, type P5Text } from './types.js';
import { activeFontMetrics } from './fontmetrics.js';

const EPS = 0.001;

// Tables measure inline text through the piece machinery with a single
// box-level space width and cap max at the widest line, and add each child's
// margins to its contribution; nested tables contribute their preferred width
// (css-tables-3 §3.4).
const INTRINSIC_POLICY: IntrinsicPolicy = {
  blockDisplays: new Set(['block', 'list-item', 'grid', 'inline-grid', 'flex', 'table']),
  skipPositioned: true,
  skipFloat: true,
  pieceText: true,
  rowFlex: false,
  childMargins: true,
  childDisplays: new Set(['block', 'list-item', 'grid', 'inline-grid', 'flex']),
  nestedTableWidth: (el, style, styles, viewport) => tablePreferredWidth(el, style, styles, null, viewport),
  borderBox: false,
  spaceStyle: 'single',
  breaks: 'cap',
};

/** HTML tags whose children are table parts; stray children of these hoist
 * above the table box instead of forming anonymous boxes (Blink's legacy
 * HTML-table behavior, probed). */
const HTML_TABLE_TAGS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr']);

function isRowGroupDisplay(d: DisplayValue): boolean {
  return d === 'table-row-group' || d === 'table-header-group' || d === 'table-footer-group';
}

/**
 * Computed style for an anonymous table box: inherits everything from its
 * parent, but as a plain box — no margins/padding/border, auto size, no
 * float/position/pseudo content (css-tables-3 §2.1 anonymous boxes carry no
 * box properties of their own).
 */
function anonymousStyle(parent: ComputedStyle, display: DisplayValue): ComputedStyle {
  const zero = pxLength(0);
  return {
    ...parent,
    display,
    margin: { top: AUTO, right: AUTO, bottom: AUTO, left: AUTO },
    padding: { top: zero, right: zero, bottom: zero, left: zero },
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
    width: AUTO,
    height: AUTO,
    minWidth: AUTO,
    maxWidth: AUTO,
    minHeight: AUTO,
    maxHeight: AUTO,
    aspectRatio: { type: 'auto' },
    float: 'none',
    position: 'static',
    zIndex: null,
    before: null,
    after: null,
    appearanceAuto: false,
  };
}

function syntheticElement(parent: P5Element, childNodes: (P5Element | P5Text)[]): P5Element {
  return {
    nodeName: '#anon',
    tagName: '#anon',
    attrs: [],
    childNodes,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    parentNode: parent,
  } as unknown as P5Element;
}

interface TableCellPart {
  el: P5Element;
  style: ComputedStyle;
  colspan: number;
  rowspan: number;
  startRow: number;
  startCol: number;
}

interface TableRowPart {
  el: P5Element | null;
  style: ComputedStyle;
  cells: TableCellPart[];
}

interface TableSectionPart {
  el: P5Element | null;
  style: ComputedStyle;
  rows: TableRowPart[];
}

interface TableCaptionPart {
  el: P5Element;
  style: ComputedStyle;
}

interface TableColumnSpec {
  widthPx: number | null;
  widthPct: number | null;
}

/** A <col> or <colgroup> box with its column span; collapse needs the group
 * boxes' own border styles, which the flat width specs drop. */
interface TableColumnBox {
  style: ComputedStyle | undefined;
  startCol: number;
  span: number;
  isGroup: boolean;
}

interface FixedTableChildren {
  sections: TableSectionPart[];
  captions: TableCaptionPart[];
  cols: TableColumnSpec[];
  colBoxes: TableColumnBox[];
  /** Running column cursor for colBoxes startCol assignment. */
  colCursor: number;
  /** HTML-table stray content hoisted above the table box (Blink legacy). */
  hoisted: (P5Element | P5Text)[];
}

function colspanOf(el: P5Element): number {
  const raw = el.attrs.find((a) => a.name === 'colspan')?.value;
  // <col>/<colgroup> span via the HTML `span` attribute, not colspan.
  const spanRaw = raw ?? el.attrs.find((a) => a.name === 'span')?.value;
  const n = spanRaw !== undefined && /^\d+$/.test(spanRaw) ? parseInt(spanRaw, 10) : 1;
  // Blink clamps the attribute to [1, 1000]; a corrupt document must not blow
  // up the column array.
  return Math.max(1, Math.min(n, 1000));
}

function rowspanOf(el: P5Element): number {
  const raw = el.attrs.find((a) => a.name === 'rowspan')?.value;
  const n = raw !== undefined && /^\d+$/.test(raw) ? parseInt(raw, 10) : 1;
  return Math.max(1, Math.min(n, 1000));
}

function columnSpecFromStyle(style: ComputedStyle | undefined): TableColumnSpec {
  if (!style) return { widthPx: null, widthPct: null };
  return {
    widthPx: style.width.px,
    widthPct: style.width.pct,
  };
}

/**
 * css-tables-3 §2.1 box fixing. Cells found where rows are expected wrap into
 * anonymous rows; rows found where row-groups are expected wrap into anonymous
 * row-groups; non-table content becomes an anonymous cell in place (css
 * display:table elements) or hoists above the table box (HTML table elements).
 */
function fixTableChildren(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  level: 'table' | 'group' | 'row',
  htmlHoist: boolean,
  out: FixedTableChildren,
): void {
  const hoist = htmlHoist && HTML_TABLE_TAGS.has(el.nodeName.toLowerCase());
  let cellRun: TableCellPart[] = [];
  let rowRun: TableRowPart[] = [];
  let strayRun: (P5Element | P5Text)[] = [];

  const pushHoisted = (node: P5Element | P5Text): void => {
    out.hoisted.push(node);
  };
  const pushStrayCell = (): void => {
    if (strayRun.length === 0) return;
    const anonEl = syntheticElement(el, strayRun);
    strayRun = [];
    cellRun.push({ el: anonEl, style: anonymousStyle(style, 'table-cell'), colspan: 1, rowspan: 1, startRow: 0, startCol: 0 });
  };
  const flushCells = (): void => {
    pushStrayCell();
    if (cellRun.length === 0) return;
    rowRun.push({ el: null, style: anonymousStyle(style, 'table-row'), cells: cellRun });
    cellRun = [];
  };
  const flushRows = (): void => {
    flushCells();
    if (rowRun.length === 0) return;
    out.sections.push({ el: null, style: anonymousStyle(style, 'table-row-group'), rows: rowRun });
    rowRun = [];
  };

  const handleChild = (childEl: P5Element, cs: ComputedStyle): void => {
    if (level === 'row') {
      if (cs.display === 'table-cell') {
        flushCells();
        cellRun.push({ el: childEl, style: cs, colspan: colspanOf(childEl), rowspan: rowspanOf(childEl), startRow: 0, startCol: 0 });
        return;
      }
      if (hoist) {
        flushCells();
        pushHoisted(childEl);
      } else {
        strayRun.push(childEl);
      }
      return;
    }
    if (level === 'group') {
      if (cs.display === 'table-row') {
        flushCells();
        rowRun.push({ el: childEl, style: cs, cells: collectRowCells(childEl, cs, styles, htmlHoist, out) });
        return;
      }
      if (cs.display === 'table-cell') {
        cellRun.push({ el: childEl, style: cs, colspan: colspanOf(childEl), rowspan: rowspanOf(childEl), startRow: 0, startCol: 0 });
        return;
      }
      if (hoist) {
        flushCells();
        pushHoisted(childEl);
      } else {
        strayRun.push(childEl);
      }
      return;
    }
    // level === 'table'
    if (cs.display === 'table-caption') {
      flushRows();
      out.captions.push({ el: childEl, style: cs });
      return;
    }
    if (cs.display === 'table-column-group' || cs.display === 'table-column') {
      flushRows();
      if (cs.display === 'table-column') {
        const span = colspanOf(childEl);
        out.colBoxes.push({ style: cs, startCol: out.colCursor, span, isGroup: false });
        pushColumnSpecs(childEl, cs, span, out);
        out.colCursor += span;
      } else {
        const kids = expandContents(childEl.childNodes, styles).filter(
          (c): c is P5Element => isElementNode(c) && styles.get(c)?.display === 'table-column',
        );
        if (kids.length > 0) {
          // The group's columns are its children's: its start column is the
          // cursor at entry and the cursor advances with the children only.
          const groupStart = out.colCursor;
          let groupSpan = 0;
          for (const k of kids) {
            const span = colspanOf(k);
            out.colBoxes.push({ style: styles.get(k), startCol: out.colCursor, span, isGroup: false });
            pushColumnSpecs(k, styles.get(k), span, out);
            out.colCursor += span;
            groupSpan += span;
          }
          out.colBoxes.push({ style: cs, startCol: groupStart, span: groupSpan, isGroup: true });
        } else {
          const span = colspanOf(childEl);
          out.colBoxes.push({ style: cs, startCol: out.colCursor, span, isGroup: true });
          pushColumnSpecs(childEl, cs, span, out);
          out.colCursor += span;
        }
      }
      return;
    }
    if (isRowGroupDisplay(cs.display)) {
      flushRows();
      out.sections.push({ el: childEl, style: cs, rows: collectGroupRows(childEl, cs, styles, htmlHoist, out) });
      return;
    }
    if (cs.display === 'table-row') {
      flushRows();
      rowRun.push({ el: childEl, style: cs, cells: collectRowCells(childEl, cs, styles, htmlHoist, out) });
      return;
    }
    if (cs.display === 'table-cell') {
      flushRows();
      cellRun.push({ el: childEl, style: cs, colspan: colspanOf(childEl), rowspan: rowspanOf(childEl), startRow: 0, startCol: 0 });
      return;
    }
    if (hoist) {
      flushRows();
      pushHoisted(childEl);
    } else {
      strayRun.push(childEl);
    }
  };

  for (const child of expandContents(el.childNodes, styles)) {
    if (isCommentNode(child)) continue;
    if (isTextNode(child)) {
      if (!/\S/.test((child as P5Text).value)) continue;
      if (hoist) {
        flushRows();
        pushHoisted(child);
      } else {
        strayRun.push(child);
      }
      continue;
    }
    const childEl = child as P5Element;
    const cs = styles.get(childEl);
    if (!cs || cs.display === 'none') continue;
    if (cs.display === 'contents') {
      // css-display-3 §2: no box — process the children at this level.
      for (const sub of expandContents(childEl.childNodes, styles)) {
        if (isCommentNode(sub)) continue;
        if (isTextNode(sub)) {
          if (/\S/.test((sub as P5Text).value)) {
            if (hoist) {
              flushRows();
              pushHoisted(sub);
            } else strayRun.push(sub);
          }
          continue;
        }
        if (!isElementNode(sub)) continue;
        const subStyle = styles.get(sub);
        if (!subStyle || subStyle.display === 'none') continue;
        handleChild(sub, subStyle);
      }
      continue;
    }
    handleChild(childEl, cs);
  }
  flushRows();
}

function pushColumnSpecs(el: P5Element, style: ComputedStyle | undefined, span: number, out: FixedTableChildren): void {
  const spec = columnSpecFromStyle(style);
  for (let i = 0; i < span; i++) out.cols.push({ ...spec });
}

function collectGroupRows(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  htmlHoist: boolean,
  out: FixedTableChildren,
): TableRowPart[] {
  const rows: TableRowPart[] = [];
  let cellRun: TableCellPart[] = [];
  let strayRun: (P5Element | P5Text)[] = [];
  const hoist = htmlHoist && HTML_TABLE_TAGS.has(el.nodeName.toLowerCase());
  const flush = (): void => {
    if (strayRun.length > 0) {
      const anonEl = syntheticElement(el, strayRun);
      strayRun = [];
      cellRun.push({ el: anonEl, style: anonymousStyle(style, 'table-cell'), colspan: 1, rowspan: 1, startRow: 0, startCol: 0 });
    }
    if (cellRun.length > 0) {
      rows.push({ el: null, style: anonymousStyle(style, 'table-row'), cells: cellRun });
      cellRun = [];
    }
  };
  for (const child of expandContents(el.childNodes, styles)) {
    if (isCommentNode(child)) continue;
    if (isTextNode(child)) {
      if (/\S/.test((child as P5Text).value)) {
        if (hoist) pushHoistedInto(out, child);
        else strayRun.push(child);
      }
      continue;
    }
    const childEl = child as P5Element;
    const cs = styles.get(childEl);
    if (!cs || cs.display === 'none') continue;
    if (cs.display === 'contents') {
      for (const row of collectGroupRows(childEl, cs, styles, htmlHoist, out)) rows.push(row);
      continue;
    }
    if (cs.display === 'table-row') {
      flush();
      rows.push({ el: childEl, style: cs, cells: collectRowCells(childEl, cs, styles, htmlHoist, out) });
      continue;
    }
    if (cs.display === 'table-cell') {
      cellRun.push({ el: childEl, style: cs, colspan: colspanOf(childEl), rowspan: rowspanOf(childEl), startRow: 0, startCol: 0 });
      continue;
    }
    flush();
    if (hoist) pushHoistedInto(out, childEl);
    else strayRun.push(childEl);
  }
  flush();
  return rows;
}

function collectRowCells(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  htmlHoist: boolean,
  out: FixedTableChildren,
): TableCellPart[] {
  const cells: TableCellPart[] = [];
  let strayRun: (P5Element | P5Text)[] = [];
  const hoist = htmlHoist && HTML_TABLE_TAGS.has(el.nodeName.toLowerCase());
  const flush = (): void => {
    if (strayRun.length === 0) return;
    const anonEl = syntheticElement(el, strayRun);
    strayRun = [];
    cells.push({ el: anonEl, style: anonymousStyle(style, 'table-cell'), colspan: 1, rowspan: 1, startRow: 0, startCol: 0 });
  };
  for (const child of expandContents(el.childNodes, styles)) {
    if (isCommentNode(child)) continue;
    if (isTextNode(child)) {
      if (/\S/.test((child as P5Text).value)) {
        if (hoist) pushHoistedInto(out, child);
        else strayRun.push(child);
      }
      continue;
    }
    const childEl = child as P5Element;
    const cs = styles.get(childEl);
    if (!cs || cs.display === 'none') continue;
    if (cs.display === 'contents') {
      for (const c of collectRowCells(childEl, cs, styles, htmlHoist, out)) cells.push(c);
      continue;
    }
    if (cs.display === 'table-cell') {
      flush();
      cells.push({ el: childEl, style: cs, colspan: colspanOf(childEl), rowspan: rowspanOf(childEl), startRow: 0, startCol: 0 });
      continue;
    }
    if (hoist) pushHoistedInto(out, childEl);
    else strayRun.push(childEl);
  }
  flush();
  return cells;
}

function pushHoistedInto(out: FixedTableChildren, node: P5Element | P5Text): void {
  out.hoisted.push(node);
}

function fixTableChildrenTop(el: P5Element, style: ComputedStyle, styles: Map<P5Element, ComputedStyle>): FixedTableChildren {
  const out: FixedTableChildren = { sections: [], captions: [], cols: [], colBoxes: [], colCursor: 0, hoisted: [] };
  const htmlHoist = HTML_TABLE_TAGS.has(el.nodeName.toLowerCase());
  fixTableChildren(el, style, styles, 'table', htmlHoist, out);
  return out;
}

// ---------------------------------------------------------------------------
// Collapsed borders (CSS 2.1 §17.6.2, Blink TableBorders)

/**
 * EBorderStyle enum order (Blink computed_style_constants.h) — the
 * style-precedence rank of the conflict algorithm. Comparison runs on the
 * COLLAPSED style (inset→ridge, outset→groove, ComputedStyle::
 * CollapsedBorderStyle), which is why a collapsed `inset` outranks a plain
 * `groove` (probed: inset beats groove, ridge beats outset).
 */
const BORDER_STYLE_RANK: Record<BorderStyleKeyword, number> = {
  none: 0,
  hidden: 1,
  inset: 2,
  groove: 3,
  outset: 4,
  ridge: 5,
  dotted: 6,
  dashed: 7,
  solid: 8,
  double: 9,
};

function collapseBorderStyle(style: BorderStyleKeyword): BorderStyleKeyword {
  if (style === 'inset') return 'ridge';
  if (style === 'outset') return 'groove';
  return style;
}

/** One winning border on a grid edge: the source box's style + physical side. */
interface CollapsedEdge {
  style: ComputedStyle;
  side: Side;
  mapped: BorderStyleKeyword;
  width: number;
  color: Color;
  /** A colspan/rowspan cell's inner edge: no table part may fill it. */
  doNotFill: boolean;
}

const NO_EDGE = null;

function collapsedEdge(style: ComputedStyle, side: Side, doNotFill = false): CollapsedEdge {
  return {
    style,
    side,
    mapped: collapseBorderStyle(style.borderStyle[side]),
    width: style.borderWidth[side],
    color: style.borderColor[side],
    doNotFill,
  };
}

/** css-tables-3 §4.2 conflict resolution (Blink IsSourceMoreSpecificThanEdge):
 * hidden wins over everything, an existing hidden can't be beaten, then wider
 * wins, then the style rank, then the first-merged source (cells merge before
 * rows before sections before cols before the table, so "first" is the
 * spec's cell > row > row group > column > column group > table precedence,
 * and within a class the top/left box wins). */
function sourceBeatsEdge(source: CollapsedEdge, edge: CollapsedEdge | null): boolean {
  if (edge === null) return true;
  if (source.mapped === 'hidden') return true;
  if (edge.mapped === 'hidden') return false;
  if (source.width < edge.width) return false;
  if (source.width > edge.width) return true;
  return BORDER_STYLE_RANK[source.mapped] > BORDER_STYLE_RANK[edge.mapped];
}

/** An edge paints (and feeds cell insets) only when its winner is a visible
 * non-zero border — a hidden or none winner suppresses the edge entirely,
 * including its layout width (probed: a lone hidden border adds no width). */
function edgePaintWidth(edge: CollapsedEdge | null): number {
  if (edge === null || edge.doNotFill) return 0;
  if (edge.mapped === 'none' || edge.mapped === 'hidden' || edge.width <= 0) return 0;
  return edge.width;
}

export interface CollapseModel {
  rows: number;
  cols: number;
  /** vertical edges v(row, columnBoundary): row < rows, boundary <= cols. */
  v: (CollapsedEdge | null)[];
  /** horizontal edges h(rowBoundary, column): boundary <= rows, column < cols. */
  h: (CollapsedEdge | null)[];
  /** Per-cell half-border insets (max paintable width over the spanned edges,
   * halved) — the cell's border box shrinks to content + padding + insets. */
  insets: Map<TableCellPart, { top: number; right: number; bottom: number; left: number }>;
  /** The table's border strut (already halved): the whole-grid pseudo-cell's
   * borders. The table's border box = grid + struts; its own padding is
   * ignored (css-tables-3 §3.6.2) and its own border merges into the edges. */
  strut: { top: number; right: number; bottom: number; left: number };
}

function buildCollapseModel(
  children: FixedTableChildren,
  totalRows: number,
  colCount: number,
  tableStyle: ComputedStyle,
): CollapseModel {
  const v: (CollapsedEdge | null)[] = new Array(totalRows * (colCount + 1)).fill(NO_EDGE);
  const h: (CollapsedEdge | null)[] = new Array((totalRows + 1) * colCount).fill(NO_EDGE);
  const vIndex = (row: number, boundary: number): number => row * (colCount + 1) + boundary;
  const hIndex = (boundary: number, col: number): number => boundary * colCount + col;

  const mergeVertical = (row: number, boundary: number, source: CollapsedEdge): void => {
    const idx = vIndex(row, boundary);
    const cur = v[idx];
    if (cur !== null && (cur.doNotFill || !sourceBeatsEdge(source, cur))) return;
    v[idx] = source;
  };
  const mergeHorizontal = (boundary: number, col: number, source: CollapsedEdge): void => {
    const idx = hIndex(boundary, col);
    const cur = h[idx];
    if (cur !== null && (cur.doNotFill || !sourceBeatsEdge(source, cur))) return;
    h[idx] = source;
  };
  // One source box's four physical sides onto its grid edge range. `none`
  // sides contribute nothing (Blink skips them per side).
  const mergeSides = (startRow: number, rowCount: number, startCol: number, colSpan: number, style: ComputedStyle): void => {
    const clampedSpan = Math.max(0, Math.min(colSpan, colCount - Math.min(startCol, colCount)));
    const clampedRows = Math.max(0, Math.min(rowCount, totalRows - Math.min(startRow, totalRows)));
    if (clampedSpan <= 0 || clampedRows <= 0) return;
    if (style.borderStyle.top !== 'none') {
      for (let c = startCol; c < startCol + clampedSpan; c++) mergeHorizontal(startRow, c, collapsedEdge(style, 'top'));
    }
    if (style.borderStyle.bottom !== 'none') {
      for (let c = startCol; c < startCol + clampedSpan; c++) mergeHorizontal(startRow + clampedRows, c, collapsedEdge(style, 'bottom'));
    }
    if (style.borderStyle.left !== 'none') {
      for (let r = startRow; r < startRow + clampedRows; r++) mergeVertical(r, startCol, collapsedEdge(style, 'left'));
    }
    if (style.borderStyle.right !== 'none') {
      for (let r = startRow; r < startRow + clampedRows; r++) mergeVertical(r, startCol + clampedSpan, collapsedEdge(style, 'right'));
    }
  };
  // A spanning cell's inner edges are unfillable by other table parts (Blink
  // MarkInnerBordersAsDoNotFill — a row border must not cut through a cell).
  const markInnerBorders = (startRow: number, rowCount: number, startCol: number, colSpan: number): void => {
    for (let r = startRow; r < startRow + rowCount; r++) {
      for (let c = startCol + 1; c < startCol + colSpan; c++) {
        const idx = vIndex(r, c);
        if (v[idx] === null) v[idx] = { style: tableStyle, side: 'left', mapped: 'none', width: 0, color: tableStyle.borderColor.top, doNotFill: true };
      }
    }
    for (let r = startRow + 1; r < startRow + rowCount; r++) {
      for (let c = startCol; c < startCol + colSpan; c++) {
        const idx = hIndex(r, c);
        if (h[idx] === null) h[idx] = { style: tableStyle, side: 'top', mapped: 'none', width: 0, color: tableStyle.borderColor.top, doNotFill: true };
      }
    }
  };

  // Conflict precedence by source class = merge order: cells, rows, row
  // groups, columns, column groups, table (css-tables-3 §4.2; Blink merges in
  // exactly this order and keeps the earlier winner on ties).
  let cellOrder: TableCellPart[] = [];
  for (const section of children.sections) {
    for (const row of section.rows) cellOrder = cellOrder.concat(row.cells);
  }
  for (const cell of cellOrder) {
    const rs = Math.max(1, Math.min(cell.rowspan, totalRows - cell.startRow));
    const cs = Math.max(1, Math.min(cell.colspan, colCount - cell.startCol));
    if (rs > 1 || cs > 1) markInnerBorders(cell.startRow, rs, cell.startCol, cs);
    mergeSides(cell.startRow, rs, cell.startCol, cs, cell.style);
  }
  let rowIndex = 0;
  for (const section of children.sections) {
    for (const row of section.rows) {
      mergeSides(rowIndex, 1, 0, colCount, row.style);
      rowIndex++;
    }
  }
  let sectionStart = 0;
  for (const section of children.sections) {
    mergeSides(sectionStart, section.rows.length, 0, colCount, section.style);
    sectionStart += section.rows.length;
  }
  for (const box of children.colBoxes) {
    if (!box.isGroup) mergeSides(0, totalRows, box.startCol, box.span, box.style ?? tableStyle);
  }
  for (const box of children.colBoxes) {
    if (box.isGroup) mergeSides(0, totalRows, box.startCol, box.span, box.style ?? tableStyle);
  }
  mergeSides(0, totalRows, 0, colCount, tableStyle);

  // Cell insets: the max paintable width over each side's spanned edges,
  // halved (the border paints centered on the cell's rect edge).
  const insets = new Map<TableCellPart, { top: number; right: number; bottom: number; left: number }>();
  for (const cell of cellOrder) {
    const rs = Math.max(1, Math.min(cell.rowspan, totalRows - cell.startRow));
    const cs = Math.max(1, Math.min(cell.colspan, colCount - cell.startCol));
    let left = 0;
    let right = 0;
    for (let r = cell.startRow; r < cell.startRow + rs; r++) {
      left = Math.max(left, edgePaintWidth(v[vIndex(r, cell.startCol)]));
      right = Math.max(right, edgePaintWidth(v[vIndex(r, cell.startCol + cs)]));
    }
    let top = 0;
    let bottom = 0;
    for (let c = cell.startCol; c < cell.startCol + cs; c++) {
      top = Math.max(top, edgePaintWidth(h[hIndex(cell.startRow, c)]));
      bottom = Math.max(bottom, edgePaintWidth(h[hIndex(cell.startRow + rs, c)]));
    }
    insets.set(cell, { top: top / 2, right: right / 2, bottom: bottom / 2, left: left / 2 });
  }

  // The table's strut: the whole-grid pseudo-cell's borders (Blink
  // UpdateTableBorder = GetCellBorders(0, 0, rows, cols), max over the outer
  // edges, halved). Later rows' wider borders grow the box (probed: no
  // first-row-only spill rule in Blink).
  let strutLeft = 0;
  let strutRight = 0;
  for (let r = 0; r < totalRows; r++) {
    strutLeft = Math.max(strutLeft, edgePaintWidth(v[vIndex(r, 0)]));
    strutRight = Math.max(strutRight, edgePaintWidth(v[vIndex(r, colCount)]));
  }
  let strutTop = 0;
  let strutBottom = 0;
  for (let c = 0; c < colCount; c++) {
    strutTop = Math.max(strutTop, edgePaintWidth(h[hIndex(0, c)]));
    strutBottom = Math.max(strutBottom, edgePaintWidth(h[hIndex(totalRows, c)]));
  }
  return {
    rows: totalRows,
    cols: colCount,
    v,
    h,
    insets,
    strut: { top: strutTop / 2, right: strutRight / 2, bottom: strutBottom / 2, left: strutLeft / 2 },
  };
}

/** A cell's layout style under collapse: the cell paints no border of its own
 * (the shared segments do) and border-radius is ignored (css-tables-3 §3.6.2;
 * probed: Chrome renders collapsed tables square). */
function collapseCellStyle(style: ComputedStyle): ComputedStyle {
  return {
    ...style,
    borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: ZERO_BORDER_RADIUS,
  };
}

// ---------------------------------------------------------------------------
// Column model

interface ColumnConstraint {
  min: number;
  max: number;
  percent: number | null;
  /** percent widths add border/padding only in fixed layout (Blink). */
  percentBorderPadding: number;
  constrained: boolean;
}

/**
 * Blink TableTypes::CreateCellInlineConstraint: resolved_min = max(min-content,
 * css min-width) in auto layout (0 in fixed layout); content_max = the
 * specified width when set, else max-content, clamped by max-width; max =
 * max(resolved_min, content_max).
 */
function cellInlineConstraint(
  cell: TableCellPart,
  styles: Map<P5Element, ComputedStyle>,
  viewport: Viewport | undefined,
  isFixedLayout: boolean,
  collapseInsets?: { top: number; right: number; bottom: number; left: number },
): ColumnConstraint {
  const style = cell.style;
  const insetH = collapseInsets ? collapseInsets.left + collapseInsets.right : style.borderWidth.left + style.borderWidth.right;
  const pb = borderPaddingInline(style, 0, viewport) - style.borderWidth.left - style.borderWidth.right + insetH;
  const specW = style.width.px;
  const pct = style.width.pct;
  const minW = style.minWidth.px;
  const maxW = style.maxWidth.px;
  const content = contentInlineSizes(cell.el, style, styles, INTRINSIC_POLICY, viewport, 0);
  let resolvedMin = isFixedLayout ? 0 : Math.max(content.min + pb, (minW ?? 0) + pb);
  let contentMax = specW !== null ? specW + pb : content.max + pb;
  if (maxW !== null) {
    contentMax = Math.min(contentMax, maxW + pb);
    resolvedMin = Math.min(resolvedMin, maxW + pb);
  }
  const resolvedMax = Math.max(resolvedMin, contentMax);
  const percentBorderPadding = isFixedLayout && pct !== null && style.boxSizing === 'content-box' ? pb : 0;
  return { min: resolvedMin, max: resolvedMax, percent: pct, percentBorderPadding, constrained: specW !== null };
}

/** Blink TableTypes::Column::Encompass. */
function mergeColumnConstraint(column: ColumnConstraint, cell: ColumnConstraint, isFixedLayout: boolean): void {
  if (column.constrained && isFixedLayout) return;
  if (column.min < cell.min) column.min = cell.min;
  if (column.constrained) {
    const cellLimit = cell.constrained ? cell.max : cell.min;
    if (column.max < cellLimit) column.max = cellLimit;
  } else {
    if (column.max < cell.max) column.max = cell.max;
  }
  if (cell.percent !== null && column.percent === null) column.percent = cell.percent;
  if (cell.constrained) column.constrained = true;
  if (column.max < column.min) column.max = column.min;
}

/**
 * The width-distribution algorithm (css-tables-3 §3.4, Blink
 * DistributeInlineSizeToComputedInlineSizeAuto): pick the first guess whose
 * size reaches the target, then grow that guess's columns by their share of
 * the increase.
 */
function distributeInlineSize(target: number, columns: ColumnConstraint[], treatTargetAsConstrained: boolean): number[] {
  const n = columns.length;
  const computed = new Array<number>(n).fill(0);
  let minSum = 0;
  let pctSum = 0;
  let specSum = 0;
  let maxSum = 0;
  let pctCount = 0;
  let fixedCount = 0;
  let autoCount = 0;
  let totalPercent = 0;
  let pctIncrease = 0;
  let fixedIncrease = 0;
  let autoIncrease = 0;
  let totalAutoMax = 0;
  let totalFixedMax = 0;
  for (const c of columns) {
    minSum += c.min;
    if (c.percent !== null) {
      pctCount++;
      totalPercent += c.percent;
      const p = percentSize(c, target);
      pctSum += p;
      specSum += p;
      maxSum += p;
      pctIncrease += p - c.min;
    } else if (c.constrained) {
      fixedCount++;
      totalFixedMax += c.max;
      pctSum += c.min;
      specSum += c.max;
      maxSum += c.max;
      fixedIncrease += c.max - c.min;
    } else {
      autoCount++;
      totalAutoMax += c.max;
      pctSum += c.min;
      specSum += c.min;
      maxSum += c.max;
      autoIncrease += c.max - c.min;
    }
  }
  const t = Math.max(target, minSum);
  const resolvePercentSize = (c: ColumnConstraint): number => percentSize(c, t);
  // pctSum/specSum are the kPercentageGuess/kSpecifiedGuess sums: a guess
  // contributes min for the column classes it does not grow (Blink
  // DistributeInlineSizeToComputedInlineSizeAuto).
  const guesses = [minSum, pctSum, specSum, maxSum];
  let start = 4;
  for (let i = 0; i < 4; i++) {
    if (guesses[i] >= t - EPS) {
      start = i;
      break;
    }
  }
  if (start === 0) {
    for (let i = 0; i < n; i++) computed[i] = columns[i].min;
    return computed;
  }
  if (start === 1) {
    const distributable = t - minSum;
    let remaining = distributable;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent !== null) {
        last = i;
        const p = resolvePercentSize(c);
        const delta = pctIncrease > EPS ? (distributable * (p - c.min)) / pctIncrease : distributable / Math.max(pctCount, 1);
        remaining -= delta;
        computed[i] = c.min + delta;
      } else {
        computed[i] = c.min;
      }
    }
    if (remaining > EPS && last >= 0) computed[last] += remaining;
    return computed;
  }
  if (start === 2) {
    const distributable = t - pctSum;
    let remaining = distributable;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent !== null) {
        computed[i] = resolvePercentSize(c);
      } else if (c.constrained) {
        last = i;
        const delta = fixedIncrease > EPS ? (distributable * (c.max - c.min)) / fixedIncrease : distributable / Math.max(fixedCount, 1);
        remaining -= delta;
        computed[i] = c.min + delta;
      } else {
        computed[i] = c.min;
      }
    }
    if (remaining > EPS && last >= 0) computed[last] += remaining;
    return computed;
  }
  if (start === 3) {
    const exact = Math.abs(t - maxSum) <= EPS;
    const distributable = exact ? 0 : t - specSum;
    let remaining = distributable;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent !== null) {
        computed[i] = resolvePercentSize(c);
      } else if (c.constrained || exact) {
        computed[i] = c.max;
      } else {
        last = i;
        const delta = autoIncrease > EPS ? (distributable * (c.max - c.min)) / autoIncrease : distributable / Math.max(autoCount, 1);
        remaining -= delta;
        computed[i] = c.min + delta;
      }
    }
    if (remaining > EPS && last >= 0) computed[last] += remaining;
    return computed;
  }
  // Above-max guess: auto columns grow proportionally to their max size; else
  // constrained columns when the target is constrained; else percent columns.
  const distributable = t - maxSum;
  if (autoCount > 0) {
    let remaining = distributable;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent !== null) {
        computed[i] = resolvePercentSize(c);
      } else if (c.constrained) {
        computed[i] = c.max;
      } else {
        last = i;
        const delta = totalAutoMax > EPS ? (distributable * c.max) / totalAutoMax : distributable / autoCount;
        remaining -= delta;
        computed[i] = c.max + delta;
      }
    }
    if (remaining > EPS && last >= 0) computed[last] += remaining;
    return computed;
  }
  if (fixedCount > 0 && treatTargetAsConstrained) {
    let remaining = distributable;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent !== null) {
        computed[i] = resolvePercentSize(c);
      } else if (c.constrained) {
        last = i;
        const delta = totalFixedMax > EPS ? (distributable * c.max) / totalFixedMax : distributable / fixedCount;
        remaining -= delta;
        computed[i] = c.max + delta;
      }
    }
    if (remaining > EPS && last >= 0) computed[last] += remaining;
    return computed;
  }
  if (pctCount > 0) {
    let remaining = distributable;
    let last = -1;
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent === null) continue;
      last = i;
      const p = resolvePercentSize(c);
      const delta = totalPercent !== 0 ? (distributable * c.percent) / totalPercent : distributable / pctCount;
      remaining -= delta;
      computed[i] = p + delta;
    }
    if (remaining > EPS && last >= 0) computed[last] += remaining;
  }
  return computed;
}

function percentSize(c: ColumnConstraint, target: number): number {
  if (c.percent === null) return c.min;
  return Math.max(c.min, (c.percent / 100) * target + c.percentBorderPadding);
}

/** Distribute a colspan cell's min/max over its spanned columns. */
function distributeColspanCell(
  constraint: ColumnConstraint,
  columns: ColumnConstraint[],
  startCol: number,
  span: number,
  spacingH: number,
): void {
  const end = Math.min(startCol + span, columns.length);
  const slice = columns.slice(startCol, end);
  if (slice.length === 0) return;
  const innerSpacing = spacingH * (slice.length - 1);
  const mins = distributeInlineSize(Math.max(0, constraint.min - innerSpacing), slice, constraint.constrained);
  for (let i = 0; i < slice.length; i++) slice[i].min = Math.max(slice[i].min, mins[i]);
  const maxes = distributeInlineSize(Math.max(0, constraint.max - innerSpacing), slice, constraint.constrained);
  for (let i = 0; i < slice.length; i++) {
    slice[i].max = Math.max(Math.max(slice[i].min, slice[i].max), maxes[i]);
    if (constraint.percent !== null && slice[i].percent === null && !slice[i].constrained) {
      slice[i].percent = constraint.percent / slice.length;
    }
  }
}

/** Fixed-layout synchronize pass (Blink
 * SynchronizeAssignableTableInlineSizeAndColumnsFixed). */
function distributeFixedSize(target: number, columns: ColumnConstraint[]): number[] {
  const n = columns.length;
  const sizes = new Array<number>(n).fill(0);
  const isFixedCol = (c: ColumnConstraint): boolean => c.constrained && c.percent === null && c.max > EPS;
  let percentTotal = 0;
  let fixedTotal = 0;
  let fixedCount = 0;
  let autoCount = 0;
  let zeroCount = 0;
  const allCount = columns.length;
  for (const c of columns) {
    if (c.percent !== null) percentTotal += percentSize(c, target);
    else if (isFixedCol(c)) {
      fixedTotal += c.max;
      fixedCount++;
    } else if (c.constrained) zeroCount++;
    else autoCount++;
  }
  let assigned = 0;
  let last = -1;
  if (fixedTotal > EPS) {
    let scale = 1;
    let scaleAvailable = true;
    const targetFixed = Math.max(0, target - percentTotal);
    // Fixed columns never shrink below their specified width: an
    // over-constrained fixed table grows instead (the table width already
    // accounts for this via tableGridWidths' constrained-column floor).
    const scaleUp = fixedTotal < targetFixed - EPS && autoCount === 0;
    if (scaleUp) {
      if (fixedTotal > EPS) scale = targetFixed / fixedTotal;
      else scaleAvailable = false;
    }
    for (let i = 0; i < n; i++) {
      if (!isFixedCol(columns[i])) continue;
      last = i;
      sizes[i] = scaleAvailable ? scale * columns[i].max : target / Math.max(fixedCount, 1);
      assigned += sizes[i];
    }
  }
  if (assigned < target - EPS && percentTotal > EPS) {
    let scale = 1;
    let scaleAvailable = true;
    const scaleUp = percentTotal < target - assigned - EPS && autoCount === 0;
    const scaleDown = percentTotal > target - assigned + EPS;
    if (scaleUp || scaleDown) {
      if (percentTotal > EPS) scale = (target - assigned) / percentTotal;
      else scaleAvailable = false;
    }
    for (let i = 0; i < n; i++) {
      if (columns[i].percent === null) continue;
      last = i;
      const p = percentSize(columns[i], target);
      sizes[i] = scaleAvailable ? scale * p : target - assigned;
      assigned += sizes[i];
    }
  }
  const distributing = Math.max(0, target - assigned);
  const distributeZero = zeroCount > 0 && zeroCount === allCount;
  const shareCount = distributeZero ? zeroCount : autoCount;
  if (shareCount > 0) {
    for (let i = 0; i < n; i++) {
      const c = columns[i];
      if (c.percent !== null || isFixedCol(c)) continue;
      if (c.constrained && !distributeZero) continue;
      last = i;
      sizes[i] = distributing / shareCount;
      assigned += sizes[i];
    }
  }
  if (last >= 0) sizes[last] += target - assigned;
  return sizes;
}

/** A nested table's preferred (border-box) width at an auto size. */
export function tablePreferredWidth(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  available: number | null,
  viewport: Viewport | undefined,
): number {
  const isFixedLayout = style.tableLayout === 'fixed';
  if (style.borderCollapse === 'collapse') {
    const { strut } = tableGridMeasures(el, style, styles, viewport, isFixedLayout);
    const padStrut = strut.left + strut.right;
    if (style.width.px !== null) {
      return style.boxSizing === 'border-box' ? style.width.px : style.width.px + padStrut;
    }
    const { min, max } = tableGridMeasures(el, style, styles, viewport, isFixedLayout);
    const clamped = Math.max(min, Math.min(max, available ?? max));
    return clamped + padStrut;
  }
  const padBorder = borderPaddingInline(style, available ?? 0, viewport);
  if (style.width.px !== null) {
    return style.boxSizing === 'border-box' ? style.width.px : style.width.px + padBorder;
  }
  const { min, max } = tableGridWidths(el, style, styles, viewport, style.tableLayout === 'fixed');
  const clamped = Math.max(min, Math.min(max, available ?? max));
  return clamped + padBorder;
}

/** Sum of column min/max widths plus the border-spacing on every grid edge. */
function tableGridWidths(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  viewport: Viewport | undefined,
  isFixedLayout: boolean,
): { min: number; max: number } {
  const { min, max } = tableGridMeasures(el, style, styles, viewport, isFixedLayout);
  return { min, max };
}

/** Column min/max sums plus the grid's undistributable edge space, and the
 * collapse strut (zero in the separate model). Captions participate with their
 * min-content (probed: a wrapped caption grows the table to its min, not its
 * max). In fixed layout only constrained columns force growth — auto columns
 * take the remainder and overflow instead (probed: fixed-nowrap keeps the
 * specified width). */
function tableGridMeasures(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  viewport: Viewport | undefined,
  isFixedLayout: boolean,
): { min: number; max: number; strut: { top: number; right: number; bottom: number; left: number } } {
  const { columns, spacingH, children, collapse } = buildColumnModel(el, style, styles, viewport, isFixedLayout);
  const edge = spacingH * (columns.length + 1);
  let min = 0;
  let max = 0;
  for (const c of columns) {
    if (isFixedLayout) {
      if (c.constrained && c.percent === null && c.max > EPS) min += c.max;
    } else {
      min += c.min;
    }
    max += c.max;
  }
  min += edge;
  max += edge;
  for (const cap of children.captions) {
    const s = cap.style;
    const sizes = contentInlineSizes(cap.el, s, styles, INTRINSIC_POLICY, viewport, 0);
    const pb = borderPaddingInline(s, 0, viewport);
    const mL = resolveLength(s.margin.left, 0, viewport) ?? 0;
    const mR = resolveLength(s.margin.right, 0, viewport) ?? 0;
    min = Math.max(min, sizes.min + pb + mL + mR);
    max = Math.max(max, sizes.min + pb + mL + mR);
  }
  return { min, max, strut: collapse?.strut ?? { top: 0, right: 0, bottom: 0, left: 0 } };
}

/**
 * Build the column constraint list for a table: assign cells to columns (first
 * free column, skipping rowspans from earlier rows), merge cell constraints
 * (Blink Column::Encompass) and col-element constraints. Fixed layout only
 * considers col elements and first-row cells.
 */
function buildColumnModel(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  viewport: Viewport | undefined,
  isFixedLayout: boolean,
): { columns: ColumnConstraint[]; spacingH: number; children: FixedTableChildren; collapse: CollapseModel | null } {
  const isCollapsed = style.borderCollapse === 'collapse';
  const spacingH = isCollapsed ? 0 : Math.max(0, style.borderSpacingH);
  const children = fixTableChildrenTop(el, style, styles);
  const occupied = new Set<string>();
  let globalRow = 0;
  const cells: TableCellPart[] = [];
  let firstRowCells: Set<TableCellPart> | null = isFixedLayout ? new Set() : null;
  for (const section of children.sections) {
    for (const row of section.rows) {
      let col = 0;
      for (const cell of row.cells) {
        while (occupied.has(`${globalRow},${col}`)) col++;
        cell.startRow = globalRow;
        cell.startCol = col;
        for (let r = 1; r < cell.rowspan; r++) {
          for (let c = 0; c < cell.colspan; c++) occupied.add(`${globalRow + r},${col + c}`);
        }
        col += cell.colspan;
        if (firstRowCells && globalRow === 0) firstRowCells.add(cell);
        cells.push(cell);
      }
      globalRow++;
    }
  }
  const colCount = Math.max(1, cells.reduce((a, c) => Math.max(a, c.startCol + c.colspan), 0), children.cols.length);
  // The collapse edge grid only needs the border styles, so it builds before
  // any sizing; its per-cell insets feed the column constraints below.
  const collapse = isCollapsed ? buildCollapseModel(children, globalRow, colCount, style) : null;
  const cellInsetOf = (cell: TableCellPart): { top: number; right: number; bottom: number; left: number } | undefined =>
    collapse?.insets.get(cell);
  const columns: ColumnConstraint[] = Array.from({ length: colCount }, () => ({
    min: 0,
    max: 0,
    percent: null,
    percentBorderPadding: 0,
    constrained: false,
  }));
  // Col-element constraints first; cell constraints encompass them. In fixed
  // layout a constrained col wins over cells entirely (Encompass).
  for (let i = 0; i < children.cols.length && i < colCount; i++) {
    const spec = children.cols[i];
    const col = columns[i];
    if (spec.widthPct !== null) {
      col.percent = spec.widthPct;
    } else if (spec.widthPx !== null) {
      col.min = Math.max(col.min, spec.widthPx);
      col.max = Math.max(col.max, spec.widthPx);
      col.constrained = true;
    }
  }
  const contributes = (cell: TableCellPart): boolean => !firstRowCells || firstRowCells.has(cell);
  for (let c = 0; c < colCount; c++) {
    for (const cell of cells) {
      if (cell.startCol !== c || cell.colspan > 1) continue;
      if (!contributes(cell)) continue;
      mergeColumnConstraint(columns[c], cellInlineConstraint(cell, styles, viewport, isFixedLayout, cellInsetOf(cell)), isFixedLayout);
    }
  }
  // Colspan cells: Blink distributes in ascending span, then start column.
  const spanCells = cells
    .filter((c) => c.colspan > 1 && contributes(c))
    .sort((a, b) => a.colspan - b.colspan || a.startCol - b.startCol);
  for (const cell of spanCells) {
    distributeColspanCell(cellInlineConstraint(cell, styles, viewport, isFixedLayout, cellInsetOf(cell)), columns, cell.startCol, cell.colspan, spacingH);
  }
  for (const col of columns) {
    if (col.max < col.min) col.max = col.min;
  }
  return { columns, spacingH, children, collapse };
}

/**
 * The table's border-box width: the specified width (never below the
 * min-content width), else shrink-to-fit over the column min/max sums
 * (css-sizing-3 §5.2: a table never shrinks below its min-content width).
 */
export function tableBorderBoxWidth(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  available: number,
  viewport: Viewport | undefined,
): number {
  const isFixedLayout = style.tableLayout === 'fixed';
  const specW = resolveLength(style.width, available, viewport);
  if (style.borderCollapse === 'collapse') {
    // The collapse struts replace the table's own border+padding outside the
    // grid (css-tables-3 §3.6.2: collapse ignores the table-root padding).
    const { min, strut } = tableGridMeasures(el, style, styles, viewport, isFixedLayout);
    const padStrut = strut.left + strut.right;
    if (specW !== null) {
      const borderBox = style.boxSizing === 'border-box' ? specW : specW + padStrut;
      return Math.max(borderBox, min + padStrut);
    }
    const { max } = tableGridMeasures(el, style, styles, viewport, isFixedLayout);
    return Math.max(min, Math.min(max, Math.max(0, available))) + padStrut;
  }
  const padBorderH =
    (resolveLength(style.padding.left, available, viewport) ?? 0) +
    (resolveLength(style.padding.right, available, viewport) ?? 0) +
    style.borderWidth.left +
    style.borderWidth.right;
  if (specW !== null) {
    const borderBox = style.boxSizing === 'border-box' ? specW : specW + padBorderH;
    const { min } = tableGridWidths(el, style, styles, viewport, isFixedLayout);
    return Math.max(borderBox, min + padBorderH);
  }
  const { min, max } = tableGridWidths(el, style, styles, viewport, isFixedLayout);
  const clamped = Math.max(min, Math.min(max, Math.max(0, available)));
  return clamped + padBorderH;
}

// ---------------------------------------------------------------------------
// Row block sizing

interface RowSizing {
  base: number;
  constrained: boolean;
  hasRowspanStart: boolean;
}

interface RowspanItem {
  startRow: number;
  span: number;
  min: number;
}

/**
 * Legacy CompareRowspanCellsInHeightDistributionOrder (Blink table_types.h):
 * spanners enclosed by another spanner distribute first, then lower start
 * rows; identical span and rows, bigger min first.
 */
function compareRowspanCells(a: RowspanItem, b: RowspanItem): number {
  const enclosed = (c1: RowspanItem, c2: RowspanItem): boolean =>
    c1.startRow >= c2.startRow && c1.startRow + c1.span <= c2.startRow + c2.span;
  if (a.startRow === b.startRow && a.span === b.span) return b.min - a.min;
  if (enclosed(a, b)) return -1;
  if (enclosed(b, a)) return 1;
  return a.startRow - b.startRow;
}

/**
 * Distribute a desired block size over rows (Blink
 * DistributeExcessBlockSizeToRows): rows with an originating rowspan equally
 * (rowspan distributions only), then unconstrained non-empty rows
 * proportionally, then empty rows equally, then all non-empty rows
 * proportionally.
 */
function distributeExcessBlockSize(
  startRow: number,
  rowCount: number,
  desired: number,
  isRowspanDistribution: boolean,
  spacingV: number,
  rows: RowSizing[],
): void {
  if (rowCount === 0) return;
  const end = startRow + rowCount;
  const withOrigins: number[] = [];
  const unconstrainedNonEmpty: number[] = [];
  const emptyRows: number[] = [];
  const unconstrainedEmpty: number[] = [];
  const nonEmpty: number[] = [];
  let constrainedNonEmptyCount = 0;
  let total = 0;
  let unconstrainedNonEmptyTotal = 0;
  for (let i = startRow; i < end; i++) {
    const row = rows[i];
    total += row.base;
    if (isRowspanDistribution && i !== startRow && row.hasRowspanStart) withOrigins.push(i);
    if (row.base <= EPS) {
      emptyRows.push(i);
      if (!row.constrained) unconstrainedEmpty.push(i);
    } else {
      nonEmpty.push(i);
      if (row.constrained) constrainedNonEmptyCount++;
      else {
        unconstrainedNonEmpty.push(i);
        unconstrainedNonEmptyTotal += row.base;
      }
    }
  }
  const distributable = desired - spacingV * (rowCount - 1) - total;
  if (distributable <= EPS) return;
  if (withOrigins.length > 0) {
    let remaining = distributable;
    for (const i of withOrigins) {
      const delta = distributable / withOrigins.length;
      rows[i].base += delta;
      remaining -= delta;
    }
    rows[withOrigins[withOrigins.length - 1]].base += remaining;
    return;
  }
  if (unconstrainedNonEmpty.length > 0) {
    let remaining = distributable;
    for (const i of unconstrainedNonEmpty) {
      const delta = (distributable * rows[i].base) / unconstrainedNonEmptyTotal;
      rows[i].base += delta;
      remaining -= delta;
    }
    rows[unconstrainedNonEmpty[unconstrainedNonEmpty.length - 1]].base += remaining;
    return;
  }
  if (emptyRows.length > 0) {
    const onlyEmpty = emptyRows.length === rowCount;
    if (!isRowspanDistribution && (onlyEmpty || emptyRows.length + constrainedNonEmptyCount === rowCount)) {
      const targets = unconstrainedEmpty.length > 0 ? unconstrainedEmpty : emptyRows;
      let remaining = distributable;
      for (const i of targets) {
        const delta = distributable / targets.length;
        rows[i].base = delta;
        remaining -= delta;
      }
      rows[targets[targets.length - 1]].base += remaining;
      return;
    }
  }
  if (nonEmpty.length > 0) {
    let remaining = distributable;
    for (const i of nonEmpty) {
      const delta = (distributable * rows[i].base) / total;
      rows[i].base += delta;
      remaining -= delta;
    }
    rows[nonEmpty[nonEmpty.length - 1]].base += remaining;
  }
}

// ---------------------------------------------------------------------------
// Layout

export interface TableLayoutInput {
  el: P5Element;
  style: ComputedStyle;
  styles: Map<P5Element, ComputedStyle>;
  /** The element's border-box left (hoisted content and captions align here). */
  borderX: number;
  /** The table box's content-box origin (inside the table's border+padding).
   * Collapse tables pass their border-box origin: the grid insets itself by
   * the strut halves. */
  contentX: number;
  contentWidth: number;
  /** The table's containing-block available inline size (its containing block
   * minus its margins): hoisted HTML-table content lays out at this width, not
   * the table's shrink-to-fit width, and fixed-layout percentage widths
   * resolve against it. Threaded from the caller (layoutBlock), never a
   * module global. */
  availableInlineSize: number;
  /** The element's border-box top: hoisted content, then captions, then box. */
  borderY: number;
  /** The table box's own paint key (collapsed border segments paint under it). */
  key: number[];
  paints: PaintOp[];
  nextOrder: () => number;
  viewport?: Viewport;
}

export interface TableLayoutResult {
  children: LayoutNode[];
  /** Content height of the table element: captions + box. */
  contentHeight: number;
  /** Height of the table box alone (excludes captions). */
  boxHeight: number;
  /** Height of hoisted content above the box (HTML tables). */
  hoistedHeight: number;
  /** Caption areas (margins + heights) above/below the box. */
  topCaptionArea: number;
  bottomCaptionArea: number;
  /** First-row baseline offset from the box's border top; null when the first
   * row has no baseline-aligned cell with text. */
  baselineOffset: number | null;
}

interface CellMeasure {
  contentHeight: number;
  cssHeight: number | null;
  /** First-line baseline relative to the cell's border top (measure pass). */
  baseline: number | null;
}

export function layoutTableContent(input: TableLayoutInput): TableLayoutResult {
  const { el, style, styles, borderX, contentX, contentWidth, availableInlineSize, borderY, paints, nextOrder, viewport } = input;
  const isFixedLayout = style.tableLayout === 'fixed';
  const isCollapsed = style.borderCollapse === 'collapse';
  const bT = style.borderWidth.top;
  const bB = style.borderWidth.bottom;
  const bL = style.borderWidth.left;
  const padT = resolveLength(style.padding.top, contentWidth, viewport) ?? 0;
  const padB = resolveLength(style.padding.bottom, contentWidth, viewport) ?? 0;
  // The column model (and its collapse edge grid) builds once here: the cell
  // parts it returns are the ones laid out below, so the per-cell collapse
  // insets keyed on them stay valid through the measure and final passes.
  const model = buildColumnModel(el, style, styles, viewport, isFixedLayout);
  const { columns, collapse, children } = model;
  const strut = collapse?.strut ?? { top: 0, right: 0, bottom: 0, left: 0 };
  // Collapse ignores the table's own border+padding (css-tables-3 §3.6.2):
  // captions and hoisted content span the border box, which already includes
  // the strut halves.
  const elemBorderW = isCollapsed
    ? contentWidth
    : contentWidth +
      bL +
      style.borderWidth.right +
      (resolveLength(style.padding.left, contentWidth, viewport) ?? 0) +
      (resolveLength(style.padding.right, contentWidth, viewport) ?? 0);

  // Hoisted HTML-table content renders above the box, at the containing
  // block's width.
  let hoistedHeight = 0;
  const outChildren: LayoutNode[] = [];
  if (children.hoisted.length > 0) {
    const hoistedEl = syntheticElement(el, children.hoisted);
    const hoistedStyle = anonymousStyle(style, 'block');
    const width = Math.max(0, availableInlineSize);
    const node = layoutElementBox(
      hoistedEl,
      hoistedStyle,
      new FloatManager(borderX, width),
      borderX,
      borderY,
      width,
      borderX,
      borderY,
      width,
      styles,
      paints,
      nextOrder,
      viewport,
    );
    hoistedHeight = node.borderHeight;
    outChildren.push(node);
  }
  const boxTop = borderY + hoistedHeight;
  const contentY = boxTop + bT + padT;

  // Captions lay out above/below the box at the element's border-box width.
  const topCaptions: TableCaptionPart[] = [];
  const bottomCaptions: TableCaptionPart[] = [];
  for (const cap of children.captions) {
    if (cap.style.captionSide === 'bottom') bottomCaptions.push(cap);
    else topCaptions.push(cap);
  }
  const captionNodes: LayoutNode[] = [];
  const layoutCaption = (cap: TableCaptionPart, capY: number): number => {
    const s = cap.style;
    const mT = resolveLength(s.margin.top, elemBorderW, viewport) ?? 0;
    const mL = resolveLength(s.margin.left, elemBorderW, viewport) ?? 0;
    const mR = resolveLength(s.margin.right, elemBorderW, viewport) ?? 0;
    // The caption's border box spans the element's border-box width minus its
    // own margins (probed: margins push the box in from both edges).
    const capW = Math.max(0, elemBorderW - mL - mR);
    const capPadL = resolveLength(s.padding.left, capW, viewport) ?? 0;
    const capPadT = resolveLength(s.padding.top, capW, viewport) ?? 0;
    const node = layoutElementBox(
      cap.el,
      s,
      new FloatManager(0, capW),
      borderX + mL,
      capY + mT,
      capW,
      borderX + mL + s.borderWidth.left + capPadL,
      capY + mT + s.borderWidth.top + capPadT,
      Math.max(0, capW - borderPaddingInline(s, capW, viewport)),
      styles,
      paints,
      nextOrder,
      viewport,
    );
    captionNodes.push(node);
    return mT + node.borderHeight + (resolveLength(s.margin.bottom, elemBorderW, viewport) ?? 0);
  };
  let topArea = 0;
  for (const cap of topCaptions) topArea += layoutCaption(cap, boxTop);

  // border-spacing applies only to the separated model; collapse grids run
  // edge to edge (css-tables-3 §3.5.2).
  const spacingH = isCollapsed ? 0 : Math.max(0, style.borderSpacingH);
  const spacingV = isCollapsed ? 0 : Math.max(0, style.borderSpacingV);
  const colCount = columns.length;
  const gridWidth = contentWidth;
  // Collapse folds the grid's outer half-borders into the struts: the grid
  // runs from borderX + strut.left across (borderWidth - struts).
  const edgeSpaceH = isCollapsed ? strut.left + strut.right : spacingH * (colCount + 1);
  const assignable = Math.max(0, gridWidth - edgeSpaceH);

  let colWidths: number[];
  if (isFixedLayout) {
    if (resolveLength(style.width, availableInlineSize, viewport) !== null) {
      colWidths = distributeFixedSize(assignable, columns);
    } else {
      colWidths = columns.map((c) => c.max);
    }
  } else {
    colWidths = distributeInlineSize(assignable, columns, true);
  }
  const colOffsets: number[] = [isCollapsed ? strut.left : spacingH];
  for (let i = 0; i < colCount; i++) colOffsets.push(colOffsets[i] + colWidths[i] + spacingH);

  // The grid starts after the top captions: the element's content box opens
  // with the caption area, then the table box's border+padding (collapse:
  // the top strut half — the table's padding is ignored, css-tables-3 §3.6.2).
  const gridTop = boxTop + topArea + (isCollapsed ? strut.top : bT + padT);

  // Place cells into the global row/column grid.
  const rows: { part: TableRowPart; cells: { cell: TableCellPart; x: number; w: number }[] }[] = [];
  {
    const occupied = new Set<string>();
    let globalRow = 0;
    for (const section of children.sections) {
      for (const row of section.rows) {
        let col = 0;
        const placed: { cell: TableCellPart; x: number; w: number }[] = [];
        for (const cell of row.cells) {
          while (occupied.has(`${globalRow},${col}`)) col++;
          cell.startRow = globalRow;
          cell.startCol = col;
          for (let r = 1; r < cell.rowspan; r++) {
            for (let c = 0; c < cell.colspan; c++) occupied.add(`${globalRow + r},${col + c}`);
          }
          const start = Math.min(col, colCount);
          const endCol = Math.min(col + cell.colspan, colCount);
          placed.push({ cell, x: contentX + colOffsets[start], w: Math.max(0, colOffsets[endCol] - colOffsets[start] - spacingH) });
          col += cell.colspan;
        }
        rows.push({ part: row, cells: placed });
        globalRow++;
      }
    }
  }

  // Measure pass: lay every cell at its assigned width (paints discarded) for
  // content heights and first-line baselines. Collapse cells lay out with
  // zeroed borders — their space is the half-border insets instead.
  const measures = new Map<TableCellPart, CellMeasure>();
  for (const row of rows) {
    for (const { cell, w } of row.cells) {
      const s = cell.style;
      const insets = collapse?.insets.get(cell) ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const cellStyle = isCollapsed ? collapseCellStyle(s) : s;
      // The content box sits inside the cell's own borders (separate) or the
      // half-border insets (collapse — the cellStyle borders are zeroed).
      const effB = isCollapsed
        ? insets
        : { top: s.borderWidth.top, right: s.borderWidth.right, bottom: s.borderWidth.bottom, left: s.borderWidth.left };
      const snapshot = paints.length;
      const node = layoutElementBox(
        cell.el,
        cellStyle,
        new FloatManager(0, w),
        0,
        0,
        w,
        effB.left + (resolveLength(s.padding.left, w, viewport) ?? 0),
        effB.top + (resolveLength(s.padding.top, w, viewport) ?? 0),
        Math.max(0, w - effB.left - effB.right - (resolveLength(s.padding.left, w, viewport) ?? 0) - (resolveLength(s.padding.right, w, viewport) ?? 0)),
        styles,
        paints,
        nextOrder,
        viewport,
      );
      paints.length = snapshot;
      // Row-min contributions: the cell's outer content height (content box +
      // padding, never the cell's own specified-height resolution — the spec
      // feeds the row raw, probed: td height:80 with 1px padding yields an
      // 80px row) and the specified height itself.
      const specH = resolveLength(s.height, w, viewport);
      const pbv = borderPaddingBlock(cellStyle, w, viewport) + (isCollapsed ? insets.top + insets.bottom : 0);
      measures.set(cell, {
        contentHeight: node.contentHeight + pbv,
        cssHeight: specH,
        baseline: node.lines[0]?.baseline ?? null,
      });
    }
  }

  // Row base sizes.
  const rowSizings: RowSizing[] = rows.map(() => ({ base: 0, constrained: false, hasRowspanStart: false }));
  const rowspanItems: RowspanItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const sizing = rowSizings[i];
    for (const { cell } of rows[i].cells) {
      const m = measures.get(cell)!;
      const effectiveRowspan = Math.max(1, Math.min(cell.rowspan, rows.length - cell.startRow));
      if (effectiveRowspan > 1) {
        sizing.hasRowspanStart = true;
        rowspanItems.push({ startRow: cell.startRow, span: effectiveRowspan, min: Math.max(m.contentHeight, m.cssHeight ?? 0) });
        continue;
      }
      sizing.base = Math.max(sizing.base, m.contentHeight, m.cssHeight ?? 0);
      if (m.cssHeight !== null) sizing.constrained = true;
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const part = rows[i].part;
    if (!part.el) continue;
    const specH = resolveLength(part.style.height, gridWidth, viewport);
    if (specH !== null) {
      rowSizings[i].base = Math.max(rowSizings[i].base, specH);
      rowSizings[i].constrained = true;
    }
  }
  rowspanItems.sort(compareRowspanCells);
  for (const item of rowspanItems) {
    distributeExcessBlockSize(item.startRow, item.span, item.min, true, spacingV, rowSizings);
  }
  const specTableH = resolveLength(style.height, contentWidth, viewport);
  if (specTableH !== null) {
    const boxSpec =
      style.boxSizing === 'border-box'
        ? specTableH
        : specTableH + borderPaddingBlock(style, contentWidth, viewport) + (isCollapsed ? strut.top + strut.bottom : 0);
    const gridDesired = Math.max(0, boxSpec - bT - bB - padT - padB - (isCollapsed ? strut.top + strut.bottom : 0) - spacingV * 2);
    distributeExcessBlockSize(0, rows.length, gridDesired, false, spacingV, rowSizings);
  }
  const rowHeights = rowSizings.map((r) => Math.max(0, r.base));
  const rowsHeight = rowHeights.reduce((a, b) => a + b, 0) + (rows.length > 1 ? spacingV * (rows.length - 1) : 0);
  const gridHeight = rows.length > 0 ? spacingV + rowsHeight + spacingV : 0;
  // The table box's border-box height: border+padding around the grid
  // (collapse: the strut halves; the table's own padding is ignored).
  const boxHeight = isCollapsed ? strut.top + gridHeight + strut.bottom : bT + padT + gridHeight + padB + bB;

  // Row positions and baselines (the grid's leading border-spacing edge sits
  // above the first row).
  const rowYs: number[] = [];
  let rowCursor = gridTop + spacingV;
  for (let i = 0; i < rows.length; i++) {
    rowYs.push(rowCursor);
    rowCursor += rowHeights[i] + spacingV;
  }
  const rowBaselines: (number | null)[] = rows.map((_, i) => {
    let baseline: number | null = null;
    for (const { cell } of rows[i].cells) {
      const m = measures.get(cell)!;
      if (cell.style.verticalAlign !== 'baseline' || m.baseline === null) continue;
      if (baseline === null || m.baseline > baseline) baseline = m.baseline;
    }
    return baseline;
  });
  // A table with no baseline-aligned cells still baselines by its first
  // cell's first-line baseline (Blink LayoutTableCell::FirstLineBaseline —
  // probed: an inline-table of middle-aligned cells aligns its cell text with
  // the surrounding line text).
  let firstRowCellBaseline: number | null = null;
  if (rows.length > 0) {
    for (const { cell } of rows[0].cells) {
      const m = measures.get(cell)!;
      if (m.baseline !== null) {
        firstRowCellBaseline = m.baseline;
        break;
      }
    }
  }

  // Final pass: lay out rows, sections, cells.
  const sectionNodes: LayoutNode[] = [];
  for (const section of children.sections) {
    const rowNodes: LayoutNode[] = [];
    for (const row of section.rows) {
      const rowIndex = rows.findIndex((r) => r.part === row);
      const rowY = rowYs[rowIndex];
      const rowH = rowHeights[rowIndex];
      const rowBaseline = rowBaselines[rowIndex];
      const cellNodes: LayoutNode[] = [];
      let minX = Infinity;
      let maxX = -Infinity;
      for (const { cell, x, w } of rows[rowIndex].cells) {
        const s = cell.style;
        const m = measures.get(cell)!;
        const insets = collapse?.insets.get(cell) ?? { top: 0, right: 0, bottom: 0, left: 0 };
        const effectiveRowspan = Math.max(1, Math.min(cell.rowspan, rows.length - cell.startRow));
        const endRow = Math.min(cell.startRow + effectiveRowspan, rows.length);
        let spanH = 0;
        for (let r = cell.startRow; r < endRow; r++) {
          spanH += rowHeights[r];
          if (r > cell.startRow) spanH += spacingV;
        }
        const bLc = s.borderWidth.left;
        const bTc = s.borderWidth.top;
        const bBc = s.borderWidth.bottom;
        // Collapse cells carry no own borders; the half-insets take their
        // place in the vertical-align algebra (the insets bound the content
        // box, and the shared border paints centered on the cell edge). The
        // separate model keeps the cell's own border widths as the inset.
        const vTopBorder = isCollapsed ? insets.top : bTc;
        const vBottomBorder = isCollapsed ? insets.bottom : bBc;
        const effL = isCollapsed ? insets.left : bLc;
        const effR = isCollapsed ? insets.right : s.borderWidth.right;
        const effT = vTopBorder;
        const padTc = resolveLength(s.padding.top, w, viewport) ?? 0;
        const padBc = resolveLength(s.padding.bottom, w, viewport) ?? 0;
        let contentShift = 0;
        if (s.verticalAlign === 'middle') {
          contentShift = Math.max(0, (spanH - vTopBorder - vBottomBorder - padTc - padBc - (m.contentHeight - vTopBorder - vBottomBorder - padTc - padBc)) / 2);
        } else if (s.verticalAlign === 'bottom') {
          contentShift = Math.max(0, spanH - m.contentHeight);
        } else if (s.verticalAlign === 'baseline' && rowBaseline !== null && m.baseline !== null) {
          contentShift = Math.max(0, rowBaseline - m.baseline);
        }
        // empty-cells:hide only applies to the separated model (css-tables-3
        // §5.2); collapsed cells always paint their resolved edges.
        const hideEmpty = !isCollapsed && s.emptyCells === 'hide' && cellIsEmpty(cell.el);
        const snapshot = hideEmpty ? paints.length : -1;
        const node = layoutElementBox(
          cell.el,
          isCollapsed ? collapseCellStyle(s) : s,
          new FloatManager(x, w),
          x,
          rowY,
          w,
          x + effL + (resolveLength(s.padding.left, w, viewport) ?? 0),
          rowY + effT + padTc + contentShift,
          Math.max(0, w - effL - effR - (resolveLength(s.padding.left, w, viewport) ?? 0) - (resolveLength(s.padding.right, w, viewport) ?? 0)),
          styles,
          paints,
          nextOrder,
          viewport,
          spanH,
        );
        if (hideEmpty) paints.length = snapshot;
        cellNodes.push(node);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + w);
      }
      rowNodes.push({
        element: row.el,
        style: row.style,
        borderX: minX === Infinity ? contentX : minX,
        borderY: rowY,
        borderWidth: maxX === -Infinity ? 0 : maxX - minX,
        borderHeight: rowH,
        contentX: minX === Infinity ? contentX : minX,
        contentY: rowY,
        contentWidth: maxX === -Infinity ? 0 : maxX - minX,
        contentHeight: rowH,
        isFloat: false,
        marginTop: 0,
        marginBottom: 0,
        flowY: rowY,
        children: cellNodes,
        lines: [],
      });
    }
    // Section rect = union of its rows.
    let sMinX = Infinity;
    let sMaxX = -Infinity;
    let sMinY = Infinity;
    let sMaxY = -Infinity;
    for (const rn of rowNodes) {
      sMinX = Math.min(sMinX, rn.borderX);
      sMaxX = Math.max(sMaxX, rn.borderX + rn.borderWidth);
      sMinY = Math.min(sMinY, rn.borderY);
      sMaxY = Math.max(sMaxY, rn.borderY + rn.borderHeight);
    }
    sectionNodes.push({
      element: section.el,
      style: section.style,
      borderX: sMinX === Infinity ? contentX : sMinX,
      borderY: sMinY === Infinity ? gridTop : sMinY,
      borderWidth: sMaxX === -Infinity ? 0 : sMaxX - sMinX,
      borderHeight: sMaxY === -Infinity ? 0 : sMaxY - sMinY,
      contentX: sMinX === Infinity ? contentX : sMinX,
      contentY: sMinY === Infinity ? gridTop : sMinY,
      contentWidth: sMaxX === -Infinity ? 0 : sMaxX - sMinX,
      contentHeight: sMaxY === -Infinity ? 0 : sMaxY - sMinY,
      isFloat: false,
      marginTop: 0,
      marginBottom: 0,
      flowY: sMinY === Infinity ? gridTop : sMinY,
      children: rowNodes,
      lines: [],
    });
  }
  outChildren.push(...sectionNodes);

  let bottomArea = 0;
  for (const cap of bottomCaptions) bottomArea += layoutCaption(cap, boxTop + topArea + boxHeight + bottomArea);
  outChildren.push(...captionNodes);

  if (collapse) pushCollapsedBorderSegments(collapse, rows, colOffsets, rowYs, rowCursor, contentX, paints, nextOrder, input.key);

  const firstBaseline = rows.length > 0 ? (rowBaselines[0] ?? firstRowCellBaseline) : null;
  const gridTopInset = isCollapsed ? strut.top : bT + padT + spacingV;
  return {
    children: outChildren,
    // The element's content height: captions + box (collapse: the box already
    // carries the strut halves; the table's own padding contributes nothing).
    contentHeight: isCollapsed ? topArea + boxHeight + bottomArea : topArea + gridHeight + bottomArea,
    boxHeight,
    hoistedHeight,
    topCaptionArea: topArea,
    bottomCaptionArea: bottomArea,
    // Baseline offset from the element's border-box top (inline-table atomics
    // align by it): hoisted content, caption area, box border+padding, then
    // the first row's baseline (css-tables-3 §14: the table's baseline is the
    // first row's).
    baselineOffset:
      firstBaseline !== null
        ? hoistedHeight + topArea + gridTopInset + firstBaseline
        : rows.length > 0
          ? hoistedHeight + topArea + gridTopInset
          : null,
  };
}

/**
 * Paint the collapsed borders: each edge paints once, centered on the grid
 * line it sits on (cell rects abut there, so the border straddles both
 * neighbors and the outer borders stay flush with the table's border box).
 * Chrome paints per cell edge in document order and the last painter wins, so
 * a shared vertical edge renders in the RIGHT neighbor's orientation and a
 * shared horizontal edge in the LOWER neighbor's; ownership below encodes
 * exactly that, and each cell pushes its edges top/right/bottom/left.
 */
function pushCollapsedBorderSegments(
  collapse: CollapseModel,
  rows: { part: TableRowPart; cells: { cell: TableCellPart; x: number; w: number }[] }[],
  colOffsets: number[],
  rowYs: number[],
  gridBottom: number,
  contentX: number,
  paints: PaintOp[],
  nextOrder: () => number,
  key: number[],
): void {
  const colX = (c: number): number => contentX + colOffsets[c];
  const rowY = (r: number): number => (r < rowYs.length ? rowYs[r] : gridBottom);
  const verticalEdge = (r: number, boundary: number): CollapsedEdge | null => collapse.v[r * (collapse.cols + 1) + boundary];
  const horizontalEdge = (boundary: number, c: number): CollapsedEdge | null => collapse.h[boundary * collapse.cols + c];

  const pushSegment = (edge: CollapsedEdge, box: Box, side: Side): void => {
    const widths = { top: 0, right: 0, bottom: 0, left: 0 };
    widths[side] = side === 'top' || side === 'bottom' ? box.height : box.width;
    pushPaintOp(paints, {
      key,
      order: nextOrder(),
      kind: 'border',
      box,
      borderWidths: widths,
      borderColors: { top: edge.color, right: edge.color, bottom: edge.color, left: edge.color },
      borderStyles: { top: edge.mapped, right: edge.mapped, bottom: edge.mapped, left: edge.mapped },
      borderRadius: ZERO_BORDER_RADIUS,
    });
  };

  // Vertical edge (r, boundary): x band centered on the column line, y over
  // the row segment, ends extended by the adjacent horizontal borders' halves
  // so corners fill (Blink's BoxCollapsedBorderPainter caps).
  const pushVertical = (r: number, boundary: number, side: 'left' | 'right'): void => {
    const edge = verticalEdge(r, boundary);
    const w = edgePaintWidth(edge);
    if (edge === null || w <= 0) return;
    const gx = colX(boundary);
    const x0 = Math.round(gx - w / 2);
    const x1 = Math.round(gx + w / 2);
    const capAt = (boundary2: number): number => {
      let cap = 0;
      if (boundary2 - 1 >= 0) cap = Math.max(cap, edgePaintWidth(horizontalEdge(r, boundary2 - 1)));
      if (boundary2 < collapse.cols) cap = Math.max(cap, edgePaintWidth(horizontalEdge(r, boundary2)));
      return cap / 2;
    };
    const y0 = Math.round(rowY(r) - capAt(boundary));
    const y1 = Math.round(rowY(r + 1) + capAt(boundary));
    pushSegment(edge, { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }, side);
  };
  // Horizontal edge (boundary, c): y band centered on the row line, x over
  // the column segment with the same corner caps.
  const pushHorizontal = (boundary: number, c: number, side: 'top' | 'bottom'): void => {
    const edge = horizontalEdge(boundary, c);
    const w = edgePaintWidth(edge);
    if (edge === null || w <= 0) return;
    const gy = rowY(boundary);
    const y0 = Math.round(gy - w / 2);
    const y1 = Math.round(gy + w / 2);
    const capAt = (r: number, boundary2: number): number => {
      let cap = 0;
      if (r - 1 >= 0) cap = Math.max(cap, edgePaintWidth(verticalEdge(r - 1, boundary2)));
      if (r < collapse.rows) cap = Math.max(cap, edgePaintWidth(verticalEdge(r, boundary2)));
      return cap / 2;
    };
    const x0 = Math.round(colX(c) - capAt(boundary, c));
    const x1 = Math.round(colX(c + 1) + capAt(boundary, c + 1));
    pushSegment(edge, { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) }, side);
  };

  for (const { cells } of rows) {
    for (const { cell } of cells) {
      const rs = Math.max(1, Math.min(cell.rowspan, collapse.rows - cell.startRow));
      const cs = Math.max(1, Math.min(cell.colspan, collapse.cols - cell.startCol));
      for (let c = cell.startCol; c < cell.startCol + cs; c++) pushHorizontal(cell.startRow, c, 'top');
      if (cell.startCol + cs === collapse.cols) {
        for (let r = cell.startRow; r < cell.startRow + rs; r++) pushVertical(r, collapse.cols, 'right');
      }
      if (cell.startRow + rs === collapse.rows) {
        for (let c = cell.startCol; c < cell.startCol + cs; c++) pushHorizontal(collapse.rows, c, 'bottom');
      }
      for (let r = cell.startRow; r < cell.startRow + rs; r++) pushVertical(r, cell.startCol, 'left');
    }
  }
}

/** A cell is empty (empty-cells:hide) when it has no element children and no
 * non-whitespace text. */
function cellIsEmpty(el: P5Element): boolean {
  for (const child of el.childNodes) {
    if (child.nodeName === '#comment') continue;
    if (child.nodeName === '#text') {
      if (/\S/.test((child as P5Text).value)) return false;
      continue;
    }
    return false;
  }
  return true;
}
