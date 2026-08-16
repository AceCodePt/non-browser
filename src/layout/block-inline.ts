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

import { parseStyleAttribute, pxLength, resolveLength, makeStyle, type BorderRadius, type ComputedStyle, type Color, type Declaration, type DecorationLine, type DisplayValue, type ListStyleType, type PseudoBox, type TextAlign, type VerticalAlign, type Viewport, type WhiteSpaceValue } from './css.js';
import { layoutTextLines, measureTextWidth, type LineBox } from './measure.js';
import { FloatManager, type FormattingContext } from './floats.js';
import { layoutGridChildren } from './grid.js';
import { layoutFlexChildren } from './flexbox.js';
import { layoutPositionedChild, initialContainingBlock, type ContainingBlock } from './positioning.js';
import { hasNonZeroRadius, type RoundedClip } from './radius.js';
import { activeFontMetrics, halfXHeight, lineAscentContribution, lineDescentContribution, roundedAscent, roundedDescent, type FontVerticalMetrics } from './fontmetrics.js';
import type { P5Element, P5Text } from './types.js';
import type { Box } from '../harness/fixtures.js';
import type { PseudoDecls } from '../cascade/phases/media-queries.js';
import { resolveUaDecls } from '../cascade/ua.js';

export { FloatManager };
export type { FormattingContext };
export { layoutPositionedChild, initialContainingBlock } from './positioning.js';

export interface StyleDefaults {
  fontFamily: string;
  fontSize: number;
  /** line-height: a px value or `normal` (resolved per-font against the element's family). */
  lineHeight: number | 'normal';
  color: Color;
  letterSpacing: number;
  textDecorationLines: DecorationLine[];
  textDecorationColor: Color | null;
  textDecorationThickness: 'auto' | 'from-font' | { px: number };
  textUnderlineOffset: number;
  /** inherited font-weight. */
  fontWeight?: number;
  /** inherited font-style. */
  fontStyle?: 'normal' | 'italic';
  /** inherited list-style-type. */
  listStyleType?: ListStyleType;
  /** UA-level default padding (e.g. td/th get 1px). */
  padding?: import('./css.js').Length;
  /** UA-level default vertical-align (e.g. table cells get 'middle'). */
  verticalAlign?: VerticalAlign;
  /** UA-level default text-align (e.g. th gets 'center'); wins over inherited. */
  textAlign?: TextAlign;
  /** inherited text-align (text-align inherits; used when no author value). */
  textAlignInherited?: TextAlign;
  /** inherited computed text-align string (start/end/justify/... preserved verbatim). */
  textAlignComputedInherited?: string;
  /** inherited white-space (white-space inherits; used when no author value). */
  whiteSpace?: WhiteSpaceValue;
  /** UA-level default border-collapse (table gets 'separate'). */
  borderCollapse?: 'separate' | 'collapse';
  /** UA-level default horizontal border-spacing (table gets 2px). */
  borderSpacing?: number;
  /** UA-level default vertical border-spacing (table gets 2px). */
  borderSpacingV?: number;
}

/** Tags whose UA default display is inline (mini-UA: the full table is a later task). */
const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'button', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd',
  'label', 'mark', 'q', 'ruby', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u',
  'var', 'wbr',
]);

/** HTML tags whose UA default display is a table display value (CSS 2.1 §17.2.1). */
const TABLE_TAGS: Record<string, DisplayValue> = {
  table: 'table',
  caption: 'table-caption',
  thead: 'table-header-group',
  tbody: 'table-row-group',
  tfoot: 'table-footer-group',
  tr: 'table-row',
  td: 'table-cell',
  th: 'table-cell',
  col: 'table-column',
  colgroup: 'table-column-group',
};

function defaultDisplayFor(tag: string): DisplayValue {
  const t = tag.toLowerCase();
  if (TABLE_TAGS[t]) return TABLE_TAGS[t];
  return INLINE_TAGS.has(t) ? 'inline' : 'block';
}

/**
 * UA-level style defaults for a table-related tag (Chrome's html.css table
 * rules): `table` gets border-collapse:separate + border-spacing:2px, `tr` gets
 * vertical-align:middle, `td`/`th` get 1px padding and vertical-align:middle,
 * and `th` gets text-align:center.
 */
function tableDefaultsFor(tag: string): Partial<StyleDefaults> {
  const t = tag.toLowerCase();
  if (t === 'table') {
    return { borderCollapse: 'separate', borderSpacing: 2, borderSpacingV: 2 };
  }
  if (t === 'tr') {
    return { verticalAlign: 'middle' };
  }
  if (t === 'td' || t === 'th') {
    return {
      padding: pxLength(1),
      verticalAlign: 'middle',
      textAlign: t === 'th' ? 'center' : undefined,
    };
  }
  return {};
}

export function resolveStyles(
  root: P5Element,
  defaults: StyleDefaults,
  stylesheetDecls?: Map<P5Element, Declaration[]>,
  pseudoDecls?: Map<P5Element, PseudoDecls>,
): Map<P5Element, ComputedStyle> {
  const map = new Map<P5Element, ComputedStyle>();
  const uaDecls = resolveUaDecls(root);
  const walk = (el: P5Element, d: StyleDefaults): void => {
    const inline = parseStyleAttribute(el.attrs.find((a) => a.name === 'style')?.value);
    const cascade = stylesheetDecls?.get(el);
    const ua = uaDecls.get(el);
    // makeStyle reads the FIRST declaration of each property, so to get CSS
    // "last wins" semantics across the cascade feed the merged list in
    // reverse — the winner appears first. Origins layer: inline style > author
    // stylesheet > UA stylesheet (each list already in ascending cascade order
    // internally, so reversing yields descending with inline on top).
    const base = [];
    if (ua && ua.length > 0) base.push(...ua);
    if (cascade && cascade.length > 0) base.push(...cascade);
    if (inline.length > 0) base.push(...inline);
    const decls = base.reverse();
    const tagDefaults = tableDefaultsFor(el.nodeName);
    const style = makeStyle(decls, {
      ...d,
      display: defaultDisplayFor(el.nodeName),
      paddingDefault: tagDefaults.padding,
      verticalAlignDefault: tagDefaults.verticalAlign,
      textAlignDefault: tagDefaults.textAlign,
      textAlignInherited: d.textAlignInherited ?? d.textAlign ?? 'left',
      textAlignComputedInherited: d.textAlignComputedInherited,
      whiteSpaceDefault: d.whiteSpace ?? 'normal',
      borderCollapseDefault: tagDefaults.borderCollapse,
      borderSpacingDefault: tagDefaults.borderSpacing,
      borderSpacingVDefault: tagDefaults.borderSpacingV,
      fontWeightDefault: d.fontWeight,
      fontStyleDefault: d.fontStyle,
      listStyleTypeDefault: d.listStyleType,
    });
    style.before = computePseudoBox(el, style, pseudoDecls, 'before');
    style.after = computePseudoBox(el, style, pseudoDecls, 'after');
    applyReplacedSize(el, style);
    map.set(el, style);
    const childDefaults: StyleDefaults = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeightNormal ? 'normal' : style.lineHeight,
      color: style.color,
      letterSpacing: style.letterSpacing,
      textDecorationLines: style.textDecorationLines,
      textDecorationColor: style.textDecorationColor,
      textDecorationThickness: style.textDecorationThickness,
      textUnderlineOffset: style.textUnderlineOffset,
      textAlignInherited: style.textAlign,
      textAlignComputedInherited: style.textAlignComputed,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      listStyleType: style.listStyleType,
      whiteSpace: style.whiteSpace,
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

/**
 * Resolve one pseudo-element (::before/::after) of an element into a
 * `PseudoBox`. The generated inline box inherits the element's font/color (its
 * computed style is built from the element's resolved inherited properties)
 * and honors author declarations targeting the pseudo. Returns null when no
 * rule targets the pseudo; `box.text` is null when the pseudo's content is
 * none/normal (no box generated).
 */
function computePseudoBox(
  el: P5Element,
  style: ComputedStyle,
  pseudoDecls: Map<P5Element, PseudoDecls> | undefined,
  which: 'before' | 'after',
): PseudoBox | null {
  const decls = pseudoDecls?.get(el)?.[which];
  if (!decls || decls.length === 0) return null;
  const box = makeStyle(decls, {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    color: style.color,
    letterSpacing: style.letterSpacing,
    textDecorationLines: style.textDecorationLines,
    textDecorationColor: style.textDecorationColor,
    textDecorationThickness: style.textDecorationThickness,
    textUnderlineOffset: style.textUnderlineOffset,
    display: 'inline',
  });
  return { text: box.content.kind === 'text' ? box.content.text : null, style: box };
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
  /** list marker to paint (disc/decimal/etc.) for a list-item element. */
  marker?: ListMarker;
}

/** The rendered list marker for one list-item (positioned in the gutter). */
export interface ListMarker {
  kind: 'disc' | 'circle' | 'square' | 'decimal';
  /** decimal marker text (e.g. "3."); absent for geometric markers. */
  text?: string;
  /** marker box right edge (decimal) / center x (geometric markers). */
  rightX?: number;
  centerX: number;
  /** center y (geometric markers) or baseline (decimal text). */
  centerY: number;
  fontSize: number;
  family: string;
  color: Color;
  /** decimal markers: the li's first-line baseline to align the counter text. */
  baseline?: number;
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
  kind: 'bg' | 'border' | 'text' | 'marker';
  box: Box;
  color?: Color;
  borderWidths?: Record<'top' | 'right' | 'bottom' | 'left', number>;
  borderColors?: Record<'top' | 'right' | 'bottom' | 'left', Color>;
  /** per-side border styles (inset/outset lighten per-side colors at paint). */
  borderStyles?: Record<'top' | 'right' | 'bottom' | 'left', 'none' | 'solid' | 'inset' | 'outset'>;
  /** list marker to paint (kind === 'marker'). */
  marker?: ListMarker;
  /** rounded-corner radii for this box's background/border paint. */
  borderRadius?: BorderRadius;
  /** rounded-rect clip from a rounded overflow:hidden ancestor (border box). */
  clip?: RoundedClip;
  text?: {
    runs: {
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
      baseline: number;
      fontSize?: number;
      family?: string;
      color?: Color;
      letterSpacing?: number;
      fontWeight?: number;
      fontStyle?: 'normal' | 'italic';
      /** per-run decoration; overrides the op-level decoration when set. */
      decorationLines?: TextDecorationPaint | null;
    }[];
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

  // List markers paint in the inline phase (they sit in the list gutter
  // beside each item's first line). Their key places them with text ops; the
  // disc/text never overlap, so order within the key is irrelevant.
  const markerOps: PaintOp[] = [];
  const collectMarkers = (n: LayoutNode): void => {
    if (n.marker) {
      markerOps.push({
        key: inFlowPaintKey(STEP_INLINE),
        order: 0,
        kind: 'marker',
        box: { x: n.marker.centerX - 8, y: n.marker.centerY - 8, width: 16, height: 16 },
        marker: n.marker,
      });
    }
    for (const c of n.children) collectMarkers(c);
  };
  collectMarkers(bodyNode);
  paints.push(...markerOps);
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
  const self = styles.get(el);
  // Generated ::before/::after text counts as inline content (an empty string
  // box is invisible and does not force a line box, matching Chrome).
  if (self && ((self.before && self.before.text) || (self.after && self.after.text))) return true;
  for (const child of el.childNodes) {
    if (child.nodeName === '#text') {
      if (/\S/.test((child as P5Text).value)) return true;
    } else if (child.nodeName !== '#comment') {
      const s = styles.get(child as P5Element);
      if (s && (s.display === 'block' || s.display === 'list-item' || s.display === 'grid' || s.display === 'flex' || s.float !== 'none')) continue;
      return true;
    }
  }
  return false;
}

/** Does this element have any block-level (or float/positioned) children? */
function hasBlockLevelChild(el: P5Element, styles: Map<P5Element, ComputedStyle>): boolean {
  for (const child of el.childNodes) {
    if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
    const s = styles.get(child as P5Element);
    if (!s || s.display === 'none') continue;
    if (s.display === 'block' || s.display === 'list-item' || s.display === 'grid' || s.display === 'flex' || s.float !== 'none' || s.position !== 'static') {
      return true;
    }
  }
  return false;
}

export function collectInlineText(el: P5Element, styles: Map<P5Element, ComputedStyle>): string {
  let out = '';
  const self = styles.get(el);
  if (self?.before?.text) out += self.before.text;
  for (const child of el.childNodes) {
    if (child.nodeName === '#text') {
      out += (child as P5Text).value;
    } else if (child.nodeName !== '#comment') {
      const s = styles.get(child as P5Element);
      if (s && (s.display === 'block' || s.display === 'list-item' || s.display === 'grid' || s.display === 'flex')) continue;
      out += collectInlineText(child as P5Element, styles);
    }
  }
  if (self?.after?.text) out += self.after.text;
  return out;
}

interface LayoutBlockInput {
  fm: FloatManager;
  contentX: number;
  contentWidth: number;
  /** content box top (absolute) — the current flow position. */
  y: number;
  prevBottomMargin: number;
  /**
   * When set, the child is the first in-flow block of a parent with no top
   * border/padding: its top margin collapses into the parent's top margin, so
   * the child sits flush with the parent's content top (CSS 2.1 §8.3.1).
   */
  collapseTop?: boolean;
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
    // Atomic inline-level boxes (inline-block) paint in the inline phase;
    // block-level boxes in the in-flow phase.
    ownKey = inFlowPaintKey(style.display === 'inline-block' ? STEP_INLINE : STEP_INFLOW);
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
  } else if (hasInlineContent(el, styles) && !hasBlockLevelChild(el, styles)) {
    const inlineRes = layoutInlineContent(el, style, styles, fm, contentX, contentY, contentWidth, paints, nextOrder, viewport);
    lines = inlineRes.lines;
    children.push(...inlineRes.children);
    contentHeight = inlineRes.contentHeight;
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
          baseline: l.baseline ?? l.y + lineAscentContribution(style.fontSize, style.lineHeight, activeFontMetrics()),
          fontSize: l.fontSize,
          family: l.family,
          color: l.color,
          letterSpacing: l.letterSpacing,
          fontWeight: l.fontWeight,
          fontStyle: l.fontStyle,
          decorationLines: l.decorationLines ?? null,
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

  // Vertical: margin collapsing with the previous sibling, then clearance. A
  // first-child whose top margin collapses into the parent sits flush with the
  // parent's content top (its margin extends above the parent's box instead of
  // offsetting it).
  const prev = ctx.collapseTop ? marginT : prevBottomMargin;
  const collapsed = collapseMargins(prev, marginT);
  let borderTop = y + collapsed - prev;
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
    const fullWidth = measureTextWidth(text, style.fontSize, style.fontFamily, ls, style.fontWeight, style.fontStyle);
    const widest = Math.max(
      0,
      ...text.split(/\s+/).map((w) => measureTextWidth(w, style.fontSize, style.fontFamily, ls, style.fontWeight, style.fontStyle)),
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
      align: style.textAlign,
      whiteSpace: style.whiteSpace,
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
          baseline: placed.borderY + (l.baseline ?? l.y + lineAscentContribution(style.fontSize, style.lineHeight, activeFontMetrics())),
          fontSize: l.fontSize,
          family: l.family,
          color: l.color,
          letterSpacing: l.letterSpacing,
          fontWeight: l.fontWeight,
          fontStyle: l.fontStyle,
          decorationLines: l.decorationLines ?? null,
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
  const parentTag = parent.nodeName;
  const isOrderedList = parentTag === 'ol';
  let listIndex = 0;

  // The parent's top margin collapses with its first in-flow block child only
  // when the parent has no top border/padding to stop it.
  const parentStyle = styles.get(parent);
  const allowTopCollapse =
    parentStyle !== undefined &&
    parentStyle.borderWidth.top === 0 &&
    (resolveLength(parentStyle.padding.top, ctx.contentWidth, viewport) ?? 0) === 0;
  let firstInFlow = true;

  // A block's children may mix inline-level items (text, inline elements) with
  // block-level boxes (CSS 2.1 §9.2.1.1): consecutive inline items form an
  // anonymous block box laid out as inline content, and block boxes stack
  // between/around them.
  let inlineRun: P5Element[] = [];
  const flushInlineRun = (): void => {
    if (inlineRun.length === 0) return;
    const anon: P5Element = { nodeName: '#anon', tagName: '#anon', attrs: [], childNodes: inlineRun } as unknown as P5Element;
    const anonStyle = styles.get(parent)!;
    const anonFm = new FloatManager(ctx.contentX, ctx.contentWidth);
    const inlineRes = layoutInlineContent(anon, anonStyle, styles, anonFm, ctx.contentX, y, ctx.contentWidth, paints, nextOrder, viewport);
    nodes.push({
      element: anon,
      style: anonStyle,
      borderX: ctx.contentX,
      borderY: y,
      borderWidth: ctx.contentWidth,
      borderHeight: inlineRes.contentHeight,
      contentX: ctx.contentX,
      contentY: y,
      contentWidth: ctx.contentWidth,
      contentHeight: inlineRes.contentHeight,
      isFloat: false,
      marginTop: 0,
      marginBottom: 0,
      flowY: y,
      children: inlineRes.children,
      lines: inlineRes.lines,
    });
    y += inlineRes.contentHeight;
    prevBottomMargin = 0;
    firstInFlow = false;
    inlineRun = [];
  };

  for (const child of parent.childNodes) {
    if (child.nodeName === '#comment') continue;
    if (child.nodeName === '#text') {
      if (/\S/.test((child as P5Text).value)) inlineRun.push(child as unknown as P5Element);
      continue;
    }
    const el = child as P5Element;
    const style = styles.get(el);
    if (!style || style.display === 'none') continue;
    if (style.position === 'absolute' || style.position === 'fixed') {
      // Out of flow: recorded with its static position, laid out by the
      // nearest positioned ancestor once that box's height is final.
      flushInlineRun();
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
      flushInlineRun();
      nodes.push(layoutFloat(el, style, { ...ctx, y }, styles, paints, nextOrder, viewport));
      continue;
    }
    if (style.display === 'inline' || style.display === 'inline-block') {
      inlineRun.push(el);
      continue;
    }
    flushInlineRun();
    const node = layoutBlock(
      el,
      style,
      {
        ...ctx,
        y,
        prevBottomMargin,
        // A UA "quirky" margin-block-start collapses through its parent (Blink's
        // `__qem`): the first in-flow child sits flush with the parent's content
        // top and its margin extends above the parent's box. Author margins do
        // not collapse into the parent this way.
        collapseTop: firstInFlow && allowTopCollapse && style.margin.top.quirk === true,
      },
      styles,
      paints,
      nextOrder,
      viewport,
    );
    firstInFlow = false;
    if (el.nodeName === 'li' && (isOrderedList || style.listStyleType !== 'none')) {
      if (isOrderedList) listIndex++;
      node.marker = listMarkerFor(node, listIndex) ?? undefined;
    }
    nodes.push(node);
    y = node.flowY + node.borderHeight + node.marginBottom;
    prevBottomMargin = node.marginBottom;
  }
  flushInlineRun();
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

/**
 * Per-run decoration for inline elements that carry their own text-decoration
 * (e.g. an inline `<a>` with the UA underline): the decoration of the run's
 * owning element, null when it has none (the block's own decoration is applied
 * at the op level).
 */
function decorationPaintForRun(owner: P5Element | null, styles: Map<P5Element, ComputedStyle>): TextDecorationPaint | null {
  if (!owner) return null;
  const s = styles.get(owner);
  if (!s || s.textDecorationLines.length === 0) return null;
  return {
    lines: s.textDecorationLines,
    color: s.textDecorationColor ?? s.color,
    thickness: s.textDecorationThickness,
    underlineOffset: s.textUnderlineOffset,
  };
}

/**
 * The first line box of a node's content, descending into anonymous-block
 * children (a list-item whose text lives in an anonymous box still aligns its
 * marker to that text's first line).
 */
function firstLineOf(node: LayoutNode): LineBox | null {
  if (node.lines.length > 0) return node.lines[0];
  for (const c of node.children) {
    const f = firstLineOf(c);
    if (f) return f;
  }
  return null;
}

/**
 * Build the list marker for a list-item's first line. Geometry matches
 * Chrome's list markers at the default font size: a 5x5 disc/circle/square
 * centered at (li.borderLeft − 14, first-line center), and decimal counters
 * right-aligned 6px before the li's content with the li's font.
 */
function listMarkerFor(node: LayoutNode, counter: number): ListMarker | null {
  const style = node.style;
  if (style.display !== 'list-item' || style.listStyleType === 'none') return null;
  const first = firstLineOf(node);
  if (!first) return null;
  const metrics = activeFontMetrics();
  const baseline = first.baseline ?? first.y + lineAscentContribution(style.fontSize, style.lineHeight, metrics);
  const centerY = first.y + first.height / 2;
  if (style.listStyleType === 'disc' || style.listStyleType === 'circle' || style.listStyleType === 'square') {
    return {
      kind: style.listStyleType,
      centerX: node.borderX - 14,
      centerY,
      fontSize: style.fontSize,
      family: style.fontFamily,
      color: style.color,
    };
  }
  if (style.listStyleType === 'decimal' || style.listStyleType === 'decimal-leading-zero') {
    const text = `${counter}.`;
    return {
      kind: 'decimal',
      text,
      rightX: node.borderX - 6,
      centerX: 0,
      centerY,
      fontSize: style.fontSize,
      family: style.fontFamily,
      color: style.color,
      baseline,
    };
  }
  return null;
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
    borderStyles: {
      top: style.borderStyle.top,
      right: style.borderStyle.right,
      bottom: style.borderStyle.bottom,
      left: style.borderStyle.left,
    },
    borderRadius: style.borderRadius,
  };
  pushPaintOp(paints, op);
  return op;
}

// ===================================================================
// Inline formatting context (line boxes with atomic inline-blocks)
// ===================================================================
//
// A block's inline content is a sequence of text runs and atomic inline-level
// boxes (display:inline-block). They share line boxes: text wraps at spaces,
// atomics are unbreakable, and every item aligns to the line's baseline
// (css-inline-3). The line box height is the max over the strut (the block's
// own font/line-height, present only when the line carries glyphs), each text
// run's half-leading-corrected font metrics, and each atomic's margin box —
// exactly the numbers Chrome produces (see fontmetrics.ts). This replaces the
// flat `layoutTextLines` path for blocks whose inline content includes
// inline-level boxes; for pure text it produces identical line boxes.

interface TextRunStyle {
  fontSize: number;
  family: string;
  color: Color;
  letterSpacing: number;
  lineHeight: number;
  /** font-weight of the run (bold runs measure/paint with the bold face). */
  fontWeight: number;
  /** font-style of the run. */
  fontStyle: 'normal' | 'italic';
}

interface AtomicPiece {
  kind: 'atomic';
  el: P5Element;
  style: ComputedStyle;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  /** border-box width (shrink-to-fit or specified). */
  borderWidth: number;
  contentWidth: number;
}

type InlinePiece =
  | { kind: 'word'; text: string; style: TextRunStyle; owner: P5Element | null }
  | { kind: 'space'; text: string }
  | { kind: 'break' }
  | AtomicPiece;

interface InlineLayoutResult {
  lines: LineBox[];
  children: LayoutNode[];
  contentHeight: number;
}

function runStyleOf(style: ComputedStyle): TextRunStyle {
  return {
    fontSize: style.fontSize,
    family: style.fontFamily,
    color: style.color,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
  };
}

/**
 * Split a text node's raw value into word/space/break pieces under the
 * element's used white-space:
 *   - normal/nowrap: runs of white space (incl. newlines) collapse to one
 *     space piece; no break pieces.
 *   - pre-line: runs of spaces/tabs collapse to one space piece, but newlines
 *     are preserved as break pieces.
 *   - pre/pre-wrap: every space is preserved (space pieces carry their exact
 *     run), newlines are preserved as break pieces.
 */
function pushTextPieces(raw: string, style: TextRunStyle, owner: P5Element | null, out: InlinePiece[], ws: WhiteSpaceValue): void {
  let run = '';
  const flushWord = (): void => {
    if (run) {
      out.push({ kind: 'word', text: run, style, owner });
      run = '';
    }
  };
  if (ws === 'pre' || ws === 'pre-wrap') {
    let spaceRun = '';
    for (const ch of raw) {
      if (ch === '\n') {
        flushWord();
        if (spaceRun) {
          out.push({ kind: 'space', text: spaceRun });
          spaceRun = '';
        }
        out.push({ kind: 'break' });
      } else if (ch === ' ') {
        flushWord();
        spaceRun += ch;
      } else {
        if (spaceRun) {
          out.push({ kind: 'space', text: spaceRun });
          spaceRun = '';
        }
        run += ch;
      }
    }
    flushWord();
    if (spaceRun) out.push({ kind: 'space', text: spaceRun });
    return;
  }
  if (ws === 'pre-line') {
    let spacePending = false;
    for (const ch of raw) {
      if (ch === '\n') {
        flushWord();
        if (spacePending) {
          out.push({ kind: 'space', text: ' ' });
          spacePending = false;
        }
        out.push({ kind: 'break' });
      } else if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f') {
        flushWord();
        spacePending = true;
      } else {
        if (spacePending) {
          out.push({ kind: 'space', text: ' ' });
          spacePending = false;
        }
        run += ch;
      }
    }
    flushWord();
    if (spacePending) out.push({ kind: 'space', text: ' ' });
    return;
  }
  const norm = raw.replace(/[ \t\r\n\f]+/g, ' ');
  for (let i = 0; i < norm.length; i++) {
    if (norm[i] === ' ') {
      flushWord();
      out.push({ kind: 'space', text: ' ' });
    } else {
      run += norm[i];
    }
  }
  flushWord();
}

/** An element that participates in inline layout as a box (not flattened text). */
function isInlineBoxStyle(s: ComputedStyle): boolean {
  return s.display === 'inline-block' && s.float === 'none' && s.position === 'static';
}

/**
 * Size an inline-block: specified width (per box-sizing) or shrink-to-fit
 * (min(max(min-content, available), max-content)), then clamp to min/max-width.
 */
function atomicBoxSize(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  refWidth: number,
  viewport: Viewport | undefined,
): { borderWidth: number; contentWidth: number } {
  const padL = resolveLength(style.padding.left, refWidth, viewport) ?? 0;
  const padR = resolveLength(style.padding.right, refWidth, viewport) ?? 0;
  const bL = style.borderWidth.left;
  const bR = style.borderWidth.right;
  const padBorderH = padL + padR + bL + bR;
  const specW = resolveLength(style.width, refWidth, viewport);
  let borderWidth: number;
  if (specW !== null) {
    borderWidth = style.boxSizing === 'border-box' ? specW : specW + padBorderH;
  } else {
    const pieces = buildPieces(el, style, styles, refWidth, viewport, style.whiteSpace);
    const sizes = piecesContentSizes(pieces, style, style.whiteSpace);
    const mL = resolveLength(style.margin.left, refWidth, viewport) ?? 0;
    const mR = resolveLength(style.margin.right, refWidth, viewport) ?? 0;
    const available = Math.max(0, refWidth - mL - mR - padBorderH);
    const contentW = Math.min(sizes.max, Math.max(sizes.min, available));
    borderWidth = contentW + padBorderH;
  }
  const minW = resolveLength(style.minWidth, refWidth, viewport);
  const maxW = resolveLength(style.maxWidth, refWidth, viewport);
  if (minW !== null) borderWidth = Math.max(borderWidth, minW);
  if (maxW !== null) borderWidth = Math.min(borderWidth, maxW);
  return { borderWidth, contentWidth: Math.max(0, borderWidth - padBorderH) };
}

/** min/max-content widths of a piece sequence (content-box, incl. spaces). */
function piecesContentSizes(pieces: InlinePiece[], style: ComputedStyle, ws: WhiteSpaceValue): { min: number; max: number } {
  const preserve = ws === 'pre' || ws === 'pre-wrap';
  let min = 0;
  let max = 0;
  let prevWasSpace = false;
  for (const p of pieces) {
    if (p.kind === 'break') continue;
    if (p.kind === 'space') {
      if (preserve) {
        max += measureTextWidth(p.text, style.fontSize, style.fontFamily, style.letterSpacing);
      }
      prevWasSpace = true;
      continue;
    }
    const w =
      p.kind === 'word'
        ? measureTextWidth(p.text, p.style.fontSize, p.style.family, p.style.letterSpacing, p.style.fontWeight, p.style.fontStyle)
        : p.marginLeft + p.borderWidth + p.marginRight;
    min = Math.max(min, w);
    if (prevWasSpace && !preserve) max += measureTextWidth(' ', style.fontSize, style.fontFamily, style.letterSpacing);
    max += w;
    prevWasSpace = false;
  }
  return { min, max };
}

/**
 * Turn one generated pseudo box into inline pieces: its text becomes word
 * pieces styled with the pseudo's computed style. An empty content string still
 * produces a box (a zero-width piece) so it is not conflated with none/normal.
 */
function pushPseudoPieces(box: PseudoBox, owner: P5Element, out: InlinePiece[], ws: WhiteSpaceValue): void {
  if (box.text === null) return;
  if (box.text === '') {
    out.push({ kind: 'word', text: '', style: runStyleOf(box.style), owner });
    return;
  }
  pushTextPieces(box.text, runStyleOf(box.style), owner, out, ws);
}

/**
 * Flatten an element's inline content into ordered pieces. Inline elements
 * (spans) contribute their text under their own style; inline-blocks become
 * atomic pieces sized up-front; block-level/floated/positioned children are
 * not part of the inline flow and are dropped (matching the pre-existing
 * block-with-inline behavior). Generated ::before content leads and ::after
 * content trails the element's own inline content.
 */
function buildPieces(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  refWidth: number,
  viewport: Viewport | undefined,
  ws: WhiteSpaceValue = style.whiteSpace,
): InlinePiece[] {
  const out: InlinePiece[] = [];
  if (style.before) pushPseudoPieces(style.before, el, out, ws);
  for (const child of el.childNodes) {
    if (child.nodeName === '#text') {
      pushTextPieces((child as P5Text).value, runStyleOf(style), el, out, ws);
      continue;
    }
    if (child.nodeName === '#comment') continue;
    const childEl = child as P5Element;
    const s = styles.get(childEl);
    if (!s || s.display === 'none') continue;
    if (s.display === 'block' || s.display === 'list-item' || s.display === 'grid' || s.display === 'flex' || s.float !== 'none' || s.position !== 'static') {
      continue;
    }
    if (isInlineBoxStyle(s)) {
      const mL = resolveLength(s.margin.left, refWidth, viewport) ?? 0;
      const mR = resolveLength(s.margin.right, refWidth, viewport) ?? 0;
      const mT = resolveLength(s.margin.top, refWidth, viewport) ?? 0;
      const mB = resolveLength(s.margin.bottom, refWidth, viewport) ?? 0;
      const { borderWidth, contentWidth } = atomicBoxSize(childEl, s, styles, refWidth, viewport);
      out.push({
        kind: 'atomic',
        el: childEl,
        style: s,
        marginLeft: mL,
        marginRight: mR,
        marginTop: mT,
        marginBottom: mB,
        borderWidth,
        contentWidth,
      });
      continue;
    }
    for (const p of buildPieces(childEl, s, styles, refWidth, viewport, s.whiteSpace)) out.push(p);
  }
  if (style.after) pushPseudoPieces(style.after, el, out, ws);
  return out;
}

interface WalkedLine {
  runs: { text: string; x: number; width: number; style: TextRunStyle; owner: P5Element | null }[];
  atomics: { piece: AtomicPiece; x: number }[];
  width: number;
}

/**
 * Walk a line's pieces left-to-right, producing text runs (with their start x
 * and measured width) and atomic placements (border-box x, line-relative).
 * Under collapsing white-space, leading/trailing spaces are dropped and one
 * space separates words; under preserved white-space every space piece
 * contributes its own width (and run text). `width` is the used (painted)
 * line width. This mirrors the line-breaking measurement so a line's wrap
 * decision equals its final rendering width.
 *
 * `stretch` (px added to every inter-word space) implements `text-align:
 * justify`: with a uniform stretch the run x/width and the line's total width
 * grow by exactly `stretch × spaceCount`, so the line fills the available
 * width the same way Chrome distributes the surplus across spaces.
 */
function walkLine(pieces: InlinePiece[], style: ComputedStyle, stretch = 0, ws: WhiteSpaceValue = 'normal'): WalkedLine {
  const preserve = ws === 'pre' || ws === 'pre-wrap';
  const runs: WalkedLine['runs'] = [];
  const atomics: WalkedLine['atomics'] = [];
  let x = 0;
  let runText = '';
  let runX = 0;
  let runStyle: TextRunStyle | null = null;
  let runOwner: P5Element | null = null;
  let prevWasSpace = false;
  let hasContent = false;
  const flush = (): void => {
    if (!runText) return;
    const spaces = (runText.match(/ /g) ?? []).length;
    const w = measureTextWidth(runText, runStyle!.fontSize, runStyle!.family, runStyle!.letterSpacing, runStyle!.fontWeight, runStyle!.fontStyle) + stretch * spaces;
    runs.push({ text: runText, x: runX, width: w, style: runStyle!, owner: runOwner });
    runText = '';
    runStyle = null;
    runOwner = null;
  };
  const spaceW = (s: TextRunStyle): number => measureTextWidth(' ', s.fontSize, s.family, s.letterSpacing, s.fontWeight, s.fontStyle) + stretch;
  for (const p of pieces) {
    if (p.kind === 'space') {
      prevWasSpace = true;
      if (preserve) {
        // Preserved space run: attach to the current run (or start one) and
        // advance x by its full width. Spaces carry no ink, so attaching them
        // to a run keeps the painted text identical while the width/geometry
        // (line box, span rects) accounts for the preserved run.
        if (runStyle === null) {
          runStyle = runStyleOf(style);
          runOwner = null;
          runX = x;
        }
        runText += p.text;
        x += measureTextWidth(p.text, runStyle.fontSize, runStyle.family, runStyle.letterSpacing, runStyle.fontWeight, runStyle.fontStyle) + stretch * p.text.length;
      }
      continue;
    }
    if (p.kind === 'word') {
      if (runStyle !== null && (runStyle !== p.style || runOwner !== p.owner)) flush();
      if (!runText) {
        if (prevWasSpace && hasContent && !preserve) {
          // The whitespace separating inline elements belongs to the line's
          // advance (an anonymous inline box): advance x by the space but do
          // not fold it into the run's text, so run boxes never double-count
          // it (matching Chrome's per-box fragments).
          x += spaceW(p.style);
        }
        runX = x;
        runStyle = p.style;
        runOwner = p.owner;
      } else if (!preserve) {
        runText += ' ';
        x += spaceW(p.style);
      }
      runText += p.text;
      x += measureTextWidth(p.text, p.style.fontSize, p.style.family, p.style.letterSpacing, p.style.fontWeight, p.style.fontStyle);
      hasContent = true;
      prevWasSpace = false;
    } else if (p.kind === 'break') {
      // Forced breaks are split out into segments before walkLine runs; a
      // stray break piece contributes nothing to a line.
      continue;
    } else {
      flush();
      if (prevWasSpace && hasContent && !preserve) x += spaceW(runStyleOf(style));
      atomics.push({ piece: p, x: x + p.marginLeft });
      x += p.marginLeft + p.borderWidth + p.marginRight;
      hasContent = true;
      prevWasSpace = false;
    }
  }
  flush();
  return { runs, atomics, width: x };
}

interface MeasuredAtomic {
  piece: AtomicPiece;
  borderHeight: number;
  /** distance from the border-box top to the baseline; null = no inline baseline. */
  baselineOffset: number | null;
}

/** Lay out an inline-block's content once (paints discarded) to get height + baseline. */
function measureAtomic(
  piece: AtomicPiece,
  styles: Map<P5Element, ComputedStyle>,
  paints: PaintOp[],
  nextOrder: () => number,
  viewport: Viewport | undefined,
): MeasuredAtomic {
  const s = piece.style;
  const padL = resolveLength(s.padding.left, piece.contentWidth, viewport) ?? 0;
  const padT = resolveLength(s.padding.top, piece.contentWidth, viewport) ?? 0;
  const bL = s.borderWidth.left;
  const bT = s.borderWidth.top;
  const fm = new FloatManager(0, piece.contentWidth);
  const snapshot = paints.length;
  const node = layoutElementBox(
    piece.el,
    s,
    fm,
    0,
    0,
    piece.borderWidth,
    bL + padL,
    bT + padT,
    piece.contentWidth,
    styles,
    paints,
    nextOrder,
    viewport,
  );
  paints.length = snapshot;
  return { piece, borderHeight: node.borderHeight, baselineOffset: atomicBaselineOffset(node, s) };
}

/**
 * css-inline-3 / CSS2.1 §10.8.1: an inline-block's baseline is the baseline of
 * its last line box (overflow visible) — else the bottom margin edge (null).
 */
function atomicBaselineOffset(node: LayoutNode, style: ComputedStyle): number | null {
  if (style.overflow !== 'visible') return null;
  const last = node.lines[node.lines.length - 1];
  if (!last) return null;
  const metrics = activeFontMetrics();
  const fontSize = last.fontSize ?? node.style.fontSize;
  const lineHeight = node.style.lineHeight;
  return last.y + lineAscentContribution(fontSize, lineHeight, metrics) - node.borderY;
}

/** Lay out one block element's inline content (text + inline-blocks) into line boxes. */
function layoutInlineContent(
  el: P5Element,
  style: ComputedStyle,
  styles: Map<P5Element, ComputedStyle>,
  fm: FormattingContext,
  contentX: number,
  contentY: number,
  contentWidth: number,
  paints: PaintOp[],
  nextOrder: () => number,
  viewport: Viewport | undefined,
): InlineLayoutResult {
  const metrics = activeFontMetrics();
  const ws = style.whiteSpace;
  const pieces = buildPieces(el, style, styles, contentWidth, viewport, ws);
  if (pieces.length === 0) return { lines: [], children: [], contentHeight: 0 };

  // Forced breaks (newlines under pre/pre-wrap/pre-line) split the piece
  // stream into segments. A trailing newline's empty final segment does not
  // produce a line box (Chrome drops it); empty interior segments do.
  const segments: InlinePiece[][] = [];
  let hasBreak = false;
  let cur: InlinePiece[] = [];
  for (const p of pieces) {
    if (p.kind === 'break') {
      hasBreak = true;
      segments.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  segments.push(cur);
  if (hasBreak && segments[segments.length - 1].length === 0) segments.pop();

  const collapseTrim = ws === 'normal' || ws === 'nowrap' || ws === 'pre-line';
  const noWrap = ws === 'pre' || ws === 'nowrap';
  const justifyAllowed = ws === 'normal' || ws === 'pre-line';

  const lines: LineBox[] = [];
  const children: LayoutNode[] = [];
  const spanBounds = new Map<P5Element, { minX: number; minY: number; maxX: number; maxY: number }>();
  let y = contentY;

  for (const seg of segments) {
    if (seg.length === 0) {
      // An empty segment is an empty line box (same height as a content line).
      const av = fm.floatIntrusion(y, y + style.lineHeight);
      lines.push({
        x: contentX + av.left,
        y,
        width: 0,
        height: style.lineHeight,
        text: '',
        startWord: 0,
        endWord: 1,
        baseline: y + lineAscentContribution(style.fontSize, style.lineHeight, metrics),
      });
      y += style.lineHeight;
      continue;
    }
    let idx = 0;
    while (idx < seg.length) {
      const av = fm.floatIntrusion(y, y + style.lineHeight);
      const lineX = contentX + av.left;
      const availWidth = Math.max(0, contentWidth - av.left - av.right);

      // ---- fill the line (greedy, breaking at the last space opportunity) ----
      const onLine: InlinePiece[] = [];
      let lastBreak = -1;
      let lineHasContent = false;
      let i = idx;
      if (noWrap) {
        // pre / nowrap: every piece of the segment lands on one line (a line
        // wider than the box overflows rather than wraps, matching Chrome).
        onLine.push(...seg);
        i = seg.length;
      } else {
        for (; i < seg.length; i++) {
          const p = seg[i];
          if (p.kind === 'space') {
            onLine.push(p);
            lastBreak = onLine.length - 1;
            continue;
          }
          const trial = walkLine([...onLine, p], style, 0, ws).width;
          if (lineHasContent && trial > availWidth) {
            if (lastBreak >= 0) {
              if (ws === 'pre-wrap') {
                // A preserved space run at the wrap point collapses to one hung
                // space on the line (Chrome keeps a single space, no ink).
                onLine.length = lastBreak;
                onLine.push({ kind: 'space', text: ' ' });
              } else {
                onLine.length = lastBreak;
              }
            }
            break;
          }
          onLine.push(p);
          lineHasContent = true;
        }
      }
      if (collapseTrim) {
        while (onLine.length > 0 && onLine[0].kind === 'space') onLine.shift();
        if (onLine.length > 0 && onLine[onLine.length - 1].kind === 'space') onLine.pop();
      }

      // ---- alignment (text-align): shift the line within its available width;
      // justify stretches inter-word spaces so non-last lines fill the width ----
      const natural = walkLine(onLine, style, 0, ws);
      const isLastLine = i >= seg.length;
      const align = style.textAlign;
      let alignOffset = 0;
      let stretch = 0;
      if (align === 'center') {
        // An overflowing line (single word wider than the box) stays at the start
        // edge under every alignment, matching Chrome.
        alignOffset = natural.width <= availWidth ? (availWidth - natural.width) / 2 : 0;
      } else if (align === 'right') {
        alignOffset = natural.width <= availWidth ? availWidth - natural.width : 0;
      } else if (align === 'justify' && justifyAllowed && !isLastLine) {
        const spaceCount = onLine.filter((p) => p.kind === 'space').length;
        if (spaceCount > 0 && natural.width < availWidth) stretch = (availWidth - natural.width) / spaceCount;
      }
      const walked = stretch !== 0 ? walkLine(onLine, style, stretch, ws) : natural;

      // ---- measure atomics: height + baseline ----
      const measured = new Map<AtomicPiece, MeasuredAtomic>();
      for (const a of walked.atomics) measured.set(a.piece, measureAtomic(a.piece, styles, paints, nextOrder, viewport));

      // ---- line box from the strut (if glyphs/whitespace), runs, and baseline atomics ----
      const hasText = onLine.some((p) => p.kind === 'word' || p.kind === 'space');
      let maxAscent = 0;
      let maxDescent = 0;
      if (hasText) {
        maxAscent = lineAscentContribution(style.fontSize, style.lineHeight, metrics);
        maxDescent = lineDescentContribution(style.fontSize, style.lineHeight, metrics);
      }
      for (const r of walked.runs) {
        const a = lineAscentContribution(r.style.fontSize, r.style.lineHeight, metrics);
        const d = lineDescentContribution(r.style.fontSize, r.style.lineHeight, metrics);
        if (a > maxAscent) maxAscent = a;
        if (d > maxDescent) maxDescent = d;
      }
      for (const a of walked.atomics) {
        const m = measured.get(a.piece)!;
        if (a.piece.style.verticalAlign !== 'baseline') continue;
        if (m.baselineOffset !== null) {
          maxAscent = Math.max(maxAscent, a.piece.marginTop + m.baselineOffset);
          maxDescent = Math.max(maxDescent, a.piece.marginBottom + m.borderHeight - m.baselineOffset);
        } else {
          // No inline baseline: the bottom margin edge sits on the line baseline,
          // so the whole margin box contributes above it.
          maxAscent = Math.max(maxAscent, a.piece.marginTop + m.borderHeight + a.piece.marginBottom);
        }
      }

      const B0 = y + maxAscent;
      const xh2 = metrics ? halfXHeight(metrics, style.fontSize) : 0;
      let lineTop = y;
      let lineBottom = B0 + maxDescent;
      for (const a of walked.atomics) {
        const m = measured.get(a.piece)!;
        const marginH = a.piece.marginTop + m.borderHeight + a.piece.marginBottom;
        const va = a.piece.style.verticalAlign;
        if (va === 'top') {
          lineBottom = Math.max(lineBottom, y + marginH);
        } else if (va === 'middle') {
          const top = B0 - xh2 - marginH / 2;
          lineTop = Math.min(lineTop, top);
          lineBottom = Math.max(lineBottom, top + marginH);
        } else if (va === 'bottom') {
          lineTop = Math.min(lineTop, B0 + maxDescent - marginH);
        }
      }
      const shift = y - lineTop;
      const baseline = B0 + shift;
      let lineHeight = lineBottom + shift - y;
      if (lineHeight <= 0) {
        // An empty interior line (pre/pre-wrap/pre-line blank segment): the
        // box still occupies a full line-height, matching Chrome.
        lineHeight = style.lineHeight;
      }

      // ---- place text runs and atomics ----
      for (const r of walked.runs) {
        // The run may start with the whitespace separating inline elements; that
        // space belongs to the line (an anonymous inline box), so a span's rect
        // starts after it and its width excludes it. (runX already sits after the
        // space, so the span x is the run x and its width is the space-stripped
        // text width.)
        const spanText = r.text.replace(/^ /, '');
        const runBox = { x: lineX + alignOffset + r.x, y, width: r.width, height: lineHeight };
        if (r.owner && r.owner !== el) {
          // A span's getBoundingClientRect is the union of its inline boxes'
          // content boxes (baseline ± rounded font metrics), not the line boxes.
          const cb = metrics
            ? {
                top: baseline - roundedAscent(metrics, r.style.fontSize),
                bottom: baseline + roundedDescent(metrics, r.style.fontSize),
              }
            : { top: runBox.y, bottom: runBox.y + runBox.height };
          const spanW = measureTextWidth(spanText, r.style.fontSize, r.style.family, r.style.letterSpacing, r.style.fontWeight, r.style.fontStyle);
          let b = spanBounds.get(r.owner);
          if (!b) {
            b = { minX: runBox.x, minY: cb.top, maxX: runBox.x + spanW, maxY: cb.bottom };
            spanBounds.set(r.owner, b);
          } else {
            b.minX = Math.min(b.minX, runBox.x);
            b.minY = Math.min(b.minY, cb.top);
            b.maxX = Math.max(b.maxX, runBox.x + spanW);
            b.maxY = Math.max(b.maxY, cb.bottom);
          }
        }
        lines.push({
          x: runBox.x,
          y: runBox.y,
          width: runBox.width,
          height: runBox.height,
          text: r.text,
          startWord: 0,
          endWord: 1,
          baseline,
          fontSize: r.style.fontSize,
          family: r.style.family,
          color: r.style.color,
          letterSpacing: r.style.letterSpacing,
        });
      }
      for (const a of walked.atomics) {
        const m = measured.get(a.piece)!;
        const borderX = lineX + alignOffset + a.x;
        const va = a.piece.style.verticalAlign;
        let borderY: number;
        if (va === 'baseline') {
          borderY =
            m.baselineOffset !== null
              ? // The margin-box top sits at baseline − ascent; the border box is
                // marginTop below it.
                baseline - m.baselineOffset
              : baseline - a.piece.marginBottom - m.borderHeight;
        } else if (va === 'top') {
          borderY = y + a.piece.marginTop;
        } else if (va === 'middle') {
          const marginH = a.piece.marginTop + m.borderHeight + a.piece.marginBottom;
          borderY = baseline - xh2 - marginH / 2 + a.piece.marginTop;
        } else {
          borderY = y + lineHeight - a.piece.marginBottom - m.borderHeight;
        }
        const node = layoutElementBox(
          a.piece.el,
          a.piece.style,
          new FloatManager(0, a.piece.contentWidth),
          borderX,
          borderY,
          a.piece.borderWidth,
          borderX + a.piece.style.borderWidth.left + (resolveLength(a.piece.style.padding.left, a.piece.contentWidth, viewport) ?? 0),
          borderY + a.piece.style.borderWidth.top + (resolveLength(a.piece.style.padding.top, a.piece.contentWidth, viewport) ?? 0),
          a.piece.contentWidth,
          styles,
          paints,
          nextOrder,
          viewport,
        );
        children.push(node);
      }

      y += lineHeight;
      idx = i;
    }
  }

  // Inline elements (spans) have no box of their own, but getBoundingClientRect
  // on them returns the union of their line boxes; emit a lightweight node so
  // paint() can report a rect for any that carry an id.
  for (const [spanEl, b] of spanBounds) {
    const hasId = spanEl.attrs.some((a) => a.name === 'id');
    if (!hasId) continue;
    children.push({
      element: spanEl,
      style: styles.get(spanEl) ?? style,
      borderX: b.minX,
      borderY: b.minY,
      borderWidth: b.maxX - b.minX,
      borderHeight: b.maxY - b.minY,
      contentX: b.minX,
      contentY: b.minY,
      contentWidth: b.maxX - b.minX,
      contentHeight: b.maxY - b.minY,
      isFloat: false,
      marginTop: 0,
      marginBottom: 0,
      flowY: b.minY,
      children: [],
      lines: [],
    });
  }

  return { lines, children, contentHeight: y - contentY };
}
