/**
 * CSS style parsing and resolution for the layout engine.
 *
 * Supports the subset of CSS needed by the floats corpus (and the minimal
 * block/inline engine beneath it): the box model (width/height, margins,
 * padding, borders, box-sizing), floats/clear, backgrounds, color, and text
 * properties (font-size, font-family, line-height, white-space). Fixtures use
 * inline `style` attributes. Lengths are px (or % of the containing block);
 * `auto` is represented as null.
 */

import { fontMetricsForFamily, roundedAscent, roundedDescent } from './fontmetrics.js';
import { foldEmExpr, parseMathValue, resolveMathExpr, type MathExpr } from './calc.js';
import { registerRecognizedProperty } from './property-coverage.js';

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
  /** currentColor sentinel (css-color-4 §4.4): parseColorOrNull returns it and
   * every color-consuming position resolves it against the element's computed
   * color at computed-value time; it never reaches serialization or paint. */
  currentColor?: boolean;
}

/**
 * A length: a px value, a percentage, a viewport-unit value, or auto. Viewport
 * units (vw/vh/vmin/vmax) resolve against the viewport input at computed-value
 * time (CSS Values §5.1), which a static renderer can do deterministically.
 */
export interface Length {
  px: number | null;
  pct: number | null;
  vw: number | null;
  vh: number | null;
  vmin: number | null;
  vmax: number | null;
  em: number | null;
  /** value-function expression (calc()/min()/max()/clamp(), css-values-4
   * §10); when present the unit slots are null and resolveLength evaluates it.
   * em coefficients are folded into px by resolveEmLength before resolution. */
  calc?: MathExpr | null;
  /** true when this is a UA "quirky" margin (Blink's `__qem`): a quirky
   * margin-block-start collapses through its parent, so the first in-flow
   * child sits flush with the parent's content top. */
  quirk?: boolean;
  auto: boolean;
}

export const AUTO: Length = { px: null, pct: null, vw: null, vh: null, vmin: null, vmax: null, em: null, auto: true };

export function pxLength(v: number): Length {
  return { px: v, pct: null, vw: null, vh: null, vmin: null, vmax: null, em: null, auto: false };
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Resolve a Length against a reference size (containing block content width).
 * Percentages resolve against `ref`; viewport units resolve against the
 * viewport input. When a viewport unit appears without a viewport, it resolves
 * to null (auto) — callers without viewport context never see one.
 */
export function resolveLength(l: Length, ref: number, viewport?: Viewport | null): number | null {
  if (l.auto) return null;
  if (l.calc) return resolveMathExpr(l.calc, ref, viewport ?? null);
  if (l.px !== null) return l.px;
  if (l.pct !== null) return (l.pct / 100) * ref;
  if (viewport) {
    const vw = viewport.width / 100;
    const vh = viewport.height / 100;
    if (l.vw !== null) return l.vw * vw;
    if (l.vh !== null) return l.vh * vh;
    if (l.vmin !== null) return l.vmin * Math.min(vw, vh);
    if (l.vmax !== null) return l.vmax * Math.max(vw, vh);
  }
  return null;
}

/**
 * Resolve the em component of a length against an element's font-size (CSS
 * Values §5.2: em lengths resolve against the element's own font-size).
 * Returns a copy with the em component folded into px when present. A calc()
 * expression's em coefficients fold the same way. The product is rounded to 4
 * decimals so binary-float products serialize like Chrome's computed values
 * (0.83 × 24px → "19.92px"); the plain-length path keeps that rounding, and
 * calc() expressions fold em without it (used-value geometry needs the float).
 */
export function resolveEmLength(l: Length, fontSize: number): Length {
  if (l.em === null && !l.calc) return l;
  if (l.calc) {
    return {
      px: null,
      pct: null,
      vw: null,
      vh: null,
      vmin: null,
      vmax: null,
      em: null,
      calc: foldEmExpr(l.calc, fontSize),
      quirk: l.quirk,
      auto: false,
    };
  }
  return { px: Math.round((l.em ?? 0) * fontSize * 1e4) / 1e4, pct: l.pct, vw: l.vw, vh: l.vh, vmin: l.vmin, vmax: l.vmax, em: null, quirk: l.quirk, auto: false };
}

/** Clamp a value to [lo, hi] — the shared clamp for every sizing pass. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export type Side = 'top' | 'right' | 'bottom' | 'left';
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

/** The computed `direction` (css-writing-modes-4 §2.2): which physical edge a
 * logical start/end resolves to along the inline axis. Inherited; initial ltr. */
export type Direction = 'ltr' | 'rtl';

export type TrackFunction =
  | { type: 'fixed'; px: number }
  | { type: 'pct'; pct: number }
  | { type: 'flex'; flex: number }
  | { type: 'auto' }
  | { type: 'min-content' }
  | { type: 'max-content' }
  | { type: 'calc'; len: Length }
  | { type: 'fit-content'; limit: Length };

export interface TrackDef {
  min: TrackFunction;
  max: TrackFunction;
  names: string[];
}

export interface NamedArea {
  rowStart: number;
  colStart: number;
  rowEnd: number;
  colEnd: number;
}

export interface GridTemplate {
  tracks: TrackDef[];
  areas: string[][] | null;
  areasByName: Map<string, NamedArea>;
  lineNames: Map<number, string[]>;
}

export type GridLineSpec =
  | { kind: 'auto' }
  | { kind: 'integer'; value: number; name?: string }
  | { kind: 'span'; count: number; name?: string }
  | { kind: 'name'; value: string };

export type SelfAlign = 'stretch' | 'start' | 'end' | 'center' | 'baseline';
export type ContentAlign =
  | 'normal'
  | 'stretch'
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export type DecorationLine = 'underline' | 'line-through' | 'overline';

/**
 * One corner's radii as authored (pre-resolution): a horizontal and a vertical
 * radius. Elliptical corners have rx !== ry; a single length gives both.
 */
export interface CornerRadii {
  rx: Length;
  ry: Length;
}

export interface BorderRadius {
  topLeft: CornerRadii;
  topRight: CornerRadii;
  bottomRight: CornerRadii;
  bottomLeft: CornerRadii;
}

/**
 * One box-shadow / text-shadow in the parsed (pre-resolution) form. The sharp
 * shadow shape is the box expanded by `spread` and translated by `x`/`y`;
 * `blur` (>= 0) is the CSS blur radius. Lengths stay Lengths so serialization
 * resolves them the way CSSOM does (css-backgrounds-3 §7.1 / css-text-decor-3).
 */
export interface Shadow {
  inset: boolean;
  x: Length;
  y: Length;
  blur: Length;
  spread: Length;
  color: Color;
}

export const ZERO_RADIUS: CornerRadii = { rx: pxLength(0), ry: pxLength(0) };

export const ZERO_BORDER_RADIUS: BorderRadius = {
  topLeft: ZERO_RADIUS,
  topRight: ZERO_RADIUS,
  bottomRight: ZERO_RADIUS,
  bottomLeft: ZERO_RADIUS,
};

export type DisplayValue =
  | 'block'
  | 'none'
  | 'contents'
  | 'grid'
  | 'inline-grid'
  | 'flex'
  | 'inline-block'
  | 'inline'
  | 'list-item'
  // --- table display values (CSS 2.1 §17.2.1) ---
  | 'table'
  | 'inline-table'
  | 'table-row'
  | 'table-cell'
  | 'table-header-group'
  | 'table-footer-group'
  | 'table-row-group'
  | 'table-column-group'
  | 'table-column'
  | 'table-caption';

export type VerticalAlign = 'baseline' | 'top' | 'middle' | 'bottom';

/**
 * Used text-alignment: the layout keyword after `start`/`end` resolve against
 * the computed direction (LTR: start→left, end→right; RTL: start→right,
 * end→left). `justify` is the used value for stretching; the last line of a
 * block always lays out at the start edge.
 */
export type TextAlign = 'left' | 'center' | 'right' | 'justify';

/**
 * The used `white-space` value (CSS Text 3 §3): how runs of white space and
 * newlines are processed and whether the text wraps. The full five-value set
 * is computed so the breaker can honor it; the old three-value set (normal /
 * nowrap / pre) is a strict subset.
 */
export type WhiteSpaceValue = 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line';

export type ListStyleType =
  | 'none'
  | 'disc'
  | 'circle'
  | 'square'
  | 'decimal'
  | 'decimal-leading-zero'
  | string;

export type ContentValue = { kind: 'none' } | { kind: 'text'; text: string };

/** The computed `overflow` value (css-overflow-3 §2). */
export type OverflowValue = 'visible' | 'hidden' | 'clip' | 'auto' | 'scroll';

/**
 * Overflow values that clip a box's content to the box (css-overflow-3 §2).
 * `visible` never clips; `hidden`/`clip`/`auto`/`scroll` all do. Chrome paints
 * these as a clip on the subtree to the box's padding box.
 */
export function clipsContent(overflow: OverflowValue): boolean {
  return overflow !== 'visible';
}

/**
 * Overflow values that establish a scroll container (css-overflow-3 §2): the
 * box becomes a block formatting context root and its first child's top margin
 * stops collapsing through it. `clip` clips without being a scroll container,
 * so margins still collapse out of it exactly as they do for `visible`.
 */
export function isScrollContainer(overflow: OverflowValue): boolean {
  return overflow === 'hidden' || overflow === 'auto' || overflow === 'scroll';
}

/**
 * The generated box a ::before/::after pseudo-element produces on its
 * originating element. `text` is null when the pseudo's content is none/normal
 * (no box is generated); an empty string still generates a box.
 */
export interface PseudoBox {
  text: string | null;
  style: ComputedStyle;
}

export type AspectRatio =
  | { type: 'auto' }
  | { type: 'ratio'; num: number; den: number; autoRatio?: boolean };

export const ASPECT_AUTO: AspectRatio = { type: 'auto' };

export interface ComputedStyle {
  display: DisplayValue;
  /** css-sizing-4 §5: `auto` or the preferred ratio num/den (`autoRatio` marks
   * the `auto <ratio>` form, which prefers the natural ratio on replaced). */
  aspectRatio: AspectRatio;
  /** css-position-3: sticky is parsed and laid out in-flow like relative at
   * scroll offset 0 (a static renderer has no scroll position). */
  position: 'static' | 'relative' | 'sticky' | 'absolute' | 'fixed';
  direction: Direction;
  zIndex: number | null;
  top: Length;
  right: Length;
  bottom: Length;
  left: Length;
  float: 'none' | 'left' | 'right';
  clear: 'none' | 'left' | 'right' | 'both';
  verticalAlign: VerticalAlign;
  textAlign: TextAlign;
  textAlignComputed: string;
  // --- table properties (CSS 2.1 §17.6) ---
  borderCollapse: 'separate' | 'collapse';
  borderSpacingH: number;
  borderSpacingV: number;
  captionSide: 'top' | 'bottom';
  tableLayout: 'auto' | 'fixed';
  emptyCells: 'show' | 'hide';
  boxSizing: 'content-box' | 'border-box';
  overflow: OverflowValue;
  width: Length;
  height: Length;
  minWidth: Length;
  maxWidth: Length;
  minHeight: Length;
  maxHeight: Length;
  margin: Record<Side, Length>;
  padding: Record<Side, Length>;
  borderWidth: Record<Side, number>;
  borderColor: Record<Side, Color>;
  borderStyle: Record<Side, 'none' | 'solid' | 'inset' | 'outset'>;
  borderRadius: BorderRadius;
  backgroundColor: Color;
  color: Color;
  /** element-level opacity (css-transforms-1 §11): composites the whole subtree
   * against what's behind it and establishes a stacking context when < 1. */
  opacity: number;
  /** box-shadows, in source order (first shadow paints on top). Not inherited. */
  boxShadow: Shadow[];
  /** text-shadows (inherited), first on top. */
  textShadow: Shadow[];
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  listStyleType: ListStyleType;
  listStylePosition: 'inside' | 'outside';
  lineHeight: number;
  /** true when line-height computed to the `normal` keyword (CSSOM reports it
   * as 'normal', while layout uses the font-metric-derived px value). */
  lineHeightNormal: boolean;
  whiteSpace: WhiteSpaceValue;
  /** css-text-3 §2.1: uppercase/lowercase/capitalize/none (inherited). */
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  /** css-text-3 §2.2: first-line indent (length/percentage), inherited raw so
   * percentages resolve per element; hanging/each-line keep Chrome's keyword-
   * preserving computed value. */
  textIndent: Length;
  textIndentHanging: boolean;
  textIndentEachLine: boolean;
  /** css-text-3 §8: extra advance per word-separator character (inherited). */
  wordSpacing: Length;
  /** css-text-3 §6.1: break-all allows breaks between any characters;
   * keep-all suppresses breaks within CJK runs. */
  wordBreak: 'normal' | 'break-all' | 'keep-all';
  /** css-text-3 §6.2 (word-wrap is a legacy alias): anywhere also feeds
   * min-content sizing; break-word only wraps when a line cannot fit. */
  overflowWrap: 'normal' | 'break-word' | 'anywhere';

  letterSpacing: number;
  /** active text-decoration lines, in the order they should paint. */
  textDecorationLines: DecorationLine[];
  textDecorationColor: Color | null;
  textDecorationThickness: 'auto' | 'from-font' | { px: number };
  textUnderlineOffset: number;

  gridTemplateColumns: GridTemplate | null;
  gridTemplateRows: GridTemplate | null;
  gridAutoColumns: TrackDef | null;
  gridAutoRows: TrackDef | null;
  gridAutoFlowColumn: boolean;
  gridAutoFlowDense: boolean;
  rowGap: Length;
  columnGap: Length;
  justifyItems: SelfAlign;
  alignItems: SelfAlign;
  justifyContent: ContentAlign;
  alignContent: ContentAlign;

  gridRowStart: GridLineSpec | null;
  gridRowEnd: GridLineSpec | null;
  gridColumnStart: GridLineSpec | null;
  gridColumnEnd: GridLineSpec | null;
  justifySelf: SelfAlign | null;
  alignSelf: SelfAlign | null;

  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse';

  flexGrow: number;
  flexShrink: number;
  flexBasis: Length;
  order: number;

  content: ContentValue;
  before: PseudoBox | null;
  after: PseudoBox | null;

  /** css-contain-3 §3.1: `normal` establishes no container; only `inline-size`
   * establishes one in v1 (`size`/`block-size` are parsed but not-yet). */
  containerType: 'normal' | 'inline-size' | 'size' | 'block-size';
  /** css-contain-3 §3.2: the query-container names this element answers to. */
  containerName: string[];
  /**
   * The element's computed custom properties (css-variables-1 §3): resolved
   * token streams after var() substitution, keyed by the case-sensitive
   * '--name'. Guaranteed-invalid names are absent (they serialize like
   * undefined, and do not inherit to descendants).
   */
  customProps: Record<string, string>;
}

/**
 * The box's padding + border extent along one axis (CSS 2.1 §8) — the single
 * authority every formatting algorithm (block, float, flex, grid, positioned)
 * uses to subtract non-content space from a box's border-box dimension.
 */
export function borderPaddingInline(style: ComputedStyle, ref: number, viewport?: Viewport | null): number {
  return (
    (resolveLength(style.padding.left, ref, viewport) ?? 0) +
    (resolveLength(style.padding.right, ref, viewport) ?? 0) +
    style.borderWidth.left +
    style.borderWidth.right
  );
}

export function borderPaddingBlock(style: ComputedStyle, ref: number, viewport?: Viewport | null): number {
  return (
    (resolveLength(style.padding.top, ref, viewport) ?? 0) +
    (resolveLength(style.padding.bottom, ref, viewport) ?? 0) +
    style.borderWidth.top +
    style.borderWidth.bottom
  );
}

/**
 * The CSS named-color set (css-color-4 §4.3), with the sRGB values the oracle
 * resolves them to. `transparent` and `currentcolor` are handled before this
 * table since their behavior differs (alpha 0 / used-value substitution).
 */
const NAMED_COLORS: Record<string, Color> = {
  aliceblue: { r: 240, g: 248, b: 255, a: 1 },
  antiquewhite: { r: 250, g: 235, b: 215, a: 1 },
  aqua: { r: 0, g: 255, b: 255, a: 1 },
  aquamarine: { r: 127, g: 255, b: 212, a: 1 },
  azure: { r: 240, g: 255, b: 255, a: 1 },
  beige: { r: 245, g: 245, b: 220, a: 1 },
  bisque: { r: 255, g: 228, b: 196, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  blanchedalmond: { r: 255, g: 235, b: 205, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  blueviolet: { r: 138, g: 43, b: 226, a: 1 },
  brown: { r: 165, g: 42, b: 42, a: 1 },
  burlywood: { r: 222, g: 184, b: 135, a: 1 },
  cadetblue: { r: 95, g: 158, b: 160, a: 1 },
  chartreuse: { r: 127, g: 255, b: 0, a: 1 },
  chocolate: { r: 210, g: 105, b: 30, a: 1 },
  coral: { r: 255, g: 127, b: 80, a: 1 },
  cornflowerblue: { r: 100, g: 149, b: 237, a: 1 },
  cornsilk: { r: 255, g: 248, b: 220, a: 1 },
  crimson: { r: 220, g: 20, b: 60, a: 1 },
  cyan: { r: 0, g: 255, b: 255, a: 1 },
  darkblue: { r: 0, g: 0, b: 139, a: 1 },
  darkcyan: { r: 0, g: 139, b: 139, a: 1 },
  darkgoldenrod: { r: 184, g: 134, b: 11, a: 1 },
  darkgray: { r: 169, g: 169, b: 169, a: 1 },
  darkgreen: { r: 0, g: 100, b: 0, a: 1 },
  darkgrey: { r: 169, g: 169, b: 169, a: 1 },
  darkkhaki: { r: 189, g: 183, b: 107, a: 1 },
  darkmagenta: { r: 139, g: 0, b: 139, a: 1 },
  darkolivegreen: { r: 85, g: 107, b: 47, a: 1 },
  darkorange: { r: 255, g: 140, b: 0, a: 1 },
  darkorchid: { r: 153, g: 50, b: 204, a: 1 },
  darkred: { r: 139, g: 0, b: 0, a: 1 },
  darksalmon: { r: 233, g: 150, b: 122, a: 1 },
  darkseagreen: { r: 143, g: 188, b: 143, a: 1 },
  darkslateblue: { r: 72, g: 61, b: 139, a: 1 },
  darkslategray: { r: 47, g: 79, b: 79, a: 1 },
  darkslategrey: { r: 47, g: 79, b: 79, a: 1 },
  darkturquoise: { r: 0, g: 206, b: 209, a: 1 },
  darkviolet: { r: 148, g: 0, b: 211, a: 1 },
  deeppink: { r: 255, g: 20, b: 147, a: 1 },
  deepskyblue: { r: 0, g: 191, b: 255, a: 1 },
  dimgray: { r: 105, g: 105, b: 105, a: 1 },
  dimgrey: { r: 105, g: 105, b: 105, a: 1 },
  dodgerblue: { r: 30, g: 144, b: 255, a: 1 },
  firebrick: { r: 178, g: 34, b: 34, a: 1 },
  floralwhite: { r: 255, g: 250, b: 240, a: 1 },
  forestgreen: { r: 34, g: 139, b: 34, a: 1 },
  fuchsia: { r: 255, g: 0, b: 255, a: 1 },
  gainsboro: { r: 220, g: 220, b: 220, a: 1 },
  ghostwhite: { r: 248, g: 248, b: 255, a: 1 },
  gold: { r: 255, g: 215, b: 0, a: 1 },
  goldenrod: { r: 218, g: 165, b: 32, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  greenyellow: { r: 173, g: 255, b: 47, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  honeydew: { r: 240, g: 255, b: 240, a: 1 },
  hotpink: { r: 255, g: 105, b: 180, a: 1 },
  indianred: { r: 205, g: 92, b: 92, a: 1 },
  indigo: { r: 75, g: 0, b: 130, a: 1 },
  ivory: { r: 255, g: 255, b: 240, a: 1 },
  khaki: { r: 240, g: 230, b: 140, a: 1 },
  lavender: { r: 230, g: 230, b: 250, a: 1 },
  lavenderblush: { r: 255, g: 240, b: 245, a: 1 },
  lawngreen: { r: 124, g: 252, b: 0, a: 1 },
  lemonchiffon: { r: 255, g: 250, b: 205, a: 1 },
  lightblue: { r: 173, g: 216, b: 230, a: 1 },
  lightcoral: { r: 240, g: 128, b: 128, a: 1 },
  lightcyan: { r: 224, g: 255, b: 255, a: 1 },
  lightgoldenrodyellow: { r: 250, g: 250, b: 210, a: 1 },
  lightgray: { r: 211, g: 211, b: 211, a: 1 },
  lightgreen: { r: 144, g: 238, b: 144, a: 1 },
  lightgrey: { r: 211, g: 211, b: 211, a: 1 },
  lightpink: { r: 255, g: 182, b: 193, a: 1 },
  lightsalmon: { r: 255, g: 160, b: 122, a: 1 },
  lightseagreen: { r: 32, g: 178, b: 170, a: 1 },
  lightskyblue: { r: 135, g: 206, b: 250, a: 1 },
  lightslategray: { r: 119, g: 136, b: 153, a: 1 },
  lightslategrey: { r: 119, g: 136, b: 153, a: 1 },
  lightsteelblue: { r: 176, g: 196, b: 222, a: 1 },
  lightyellow: { r: 255, g: 255, b: 224, a: 1 },
  lime: { r: 0, g: 255, b: 0, a: 1 },
  limegreen: { r: 50, g: 205, b: 50, a: 1 },
  linen: { r: 250, g: 240, b: 230, a: 1 },
  magenta: { r: 255, g: 0, b: 255, a: 1 },
  maroon: { r: 128, g: 0, b: 0, a: 1 },
  mediumaquamarine: { r: 102, g: 205, b: 170, a: 1 },
  mediumblue: { r: 0, g: 0, b: 205, a: 1 },
  mediumorchid: { r: 186, g: 85, b: 211, a: 1 },
  mediumpurple: { r: 147, g: 112, b: 219, a: 1 },
  mediumseagreen: { r: 60, g: 179, b: 113, a: 1 },
  mediumslateblue: { r: 123, g: 104, b: 238, a: 1 },
  mediumspringgreen: { r: 0, g: 250, b: 154, a: 1 },
  mediumturquoise: { r: 72, g: 209, b: 204, a: 1 },
  mediumvioletred: { r: 199, g: 21, b: 133, a: 1 },
  midnightblue: { r: 25, g: 25, b: 112, a: 1 },
  mintcream: { r: 245, g: 255, b: 250, a: 1 },
  mistyrose: { r: 255, g: 228, b: 225, a: 1 },
  moccasin: { r: 255, g: 228, b: 181, a: 1 },
  navajowhite: { r: 255, g: 222, b: 173, a: 1 },
  navy: { r: 0, g: 0, b: 128, a: 1 },
  oldlace: { r: 253, g: 245, b: 230, a: 1 },
  olive: { r: 128, g: 128, b: 0, a: 1 },
  olivedrab: { r: 107, g: 142, b: 35, a: 1 },
  orange: { r: 255, g: 165, b: 0, a: 1 },
  orangered: { r: 255, g: 69, b: 0, a: 1 },
  orchid: { r: 218, g: 112, b: 214, a: 1 },
  palegoldenrod: { r: 238, g: 232, b: 170, a: 1 },
  palegreen: { r: 152, g: 251, b: 152, a: 1 },
  paleturquoise: { r: 175, g: 238, b: 238, a: 1 },
  palevioletred: { r: 219, g: 112, b: 147, a: 1 },
  papayawhip: { r: 255, g: 239, b: 213, a: 1 },
  peachpuff: { r: 255, g: 218, b: 185, a: 1 },
  peru: { r: 205, g: 133, b: 63, a: 1 },
  pink: { r: 255, g: 192, b: 203, a: 1 },
  plum: { r: 221, g: 160, b: 221, a: 1 },
  powderblue: { r: 176, g: 224, b: 230, a: 1 },
  purple: { r: 128, g: 0, b: 128, a: 1 },
  rebeccapurple: { r: 102, g: 51, b: 153, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  rosybrown: { r: 188, g: 143, b: 143, a: 1 },
  royalblue: { r: 65, g: 105, b: 225, a: 1 },
  saddlebrown: { r: 139, g: 69, b: 19, a: 1 },
  salmon: { r: 250, g: 128, b: 114, a: 1 },
  sandybrown: { r: 244, g: 164, b: 96, a: 1 },
  seagreen: { r: 46, g: 139, b: 87, a: 1 },
  seashell: { r: 255, g: 245, b: 238, a: 1 },
  sienna: { r: 160, g: 82, b: 45, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
  skyblue: { r: 135, g: 206, b: 235, a: 1 },
  slateblue: { r: 106, g: 90, b: 205, a: 1 },
  slategray: { r: 112, g: 128, b: 144, a: 1 },
  slategrey: { r: 112, g: 128, b: 144, a: 1 },
  snow: { r: 255, g: 250, b: 250, a: 1 },
  springgreen: { r: 0, g: 255, b: 127, a: 1 },
  steelblue: { r: 70, g: 130, b: 180, a: 1 },
  tan: { r: 210, g: 180, b: 140, a: 1 },
  teal: { r: 0, g: 128, b: 128, a: 1 },
  thistle: { r: 216, g: 191, b: 216, a: 1 },
  tomato: { r: 255, g: 99, b: 71, a: 1 },
  turquoise: { r: 64, g: 224, b: 208, a: 1 },
  violet: { r: 238, g: 130, b: 238, a: 1 },
  wheat: { r: 245, g: 222, b: 179, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  whitesmoke: { r: 245, g: 245, b: 245, a: 1 },
  yellow: { r: 255, g: 255, b: 0, a: 1 },
  yellowgreen: { r: 154, g: 205, b: 50, a: 1 },
};

/**
 * css-color-4 color parsing. Returns null for anything the grammar rejects so
 * the caller drops the declaration like Chrome's parse-error recovery — never
 * the black fallback. `currentcolor` parses to the sentinel resolved by the
 * caller against the element's computed color.
 */
export function parseColorOrNull(input: string): Color | null {
  const s = input.trim().toLowerCase();
  if (s === 'currentcolor') return { r: 0, g: 0, b: 0, a: 1, currentColor: true };
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a] = hex.split('').map((h) => parseInt(h + h, 16));
      return { r, g, b, a: a !== undefined ? a / 255 : 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    return null;
  }
  const fn = s.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (!fn) {
    const named = NAMED_COLORS[s];
    return named ? { ...named } : null;
  }
  const kind = fn[1].startsWith('hsl') ? 'hsl' : 'rgb';
  const body = fn[2];
  // Legacy comma form: exactly 3 color args + optional 4th alpha, all
  // comma-separated (kept — current-Chrome parity, not legacy exclusion).
  // Modern form: whitespace-separated args + optional `/ alpha`.
  let args: string[];
  let alphaRaw: string | null = null;
  if (body.includes(',')) {
    const parts = splitOnTopLevelComma(body);
    if (parts.length === 4) {
      args = parts.slice(0, 3);
      alphaRaw = parts[3];
    } else if (parts.length === 3) {
      args = parts;
    } else {
      return null;
    }
    for (const p of args) if (/\s/.test(p.trim())) return null;
  } else {
    const slash = splitTopLevelBy(body, '/');
    if (slash.length > 2) return null;
    args = splitTopLevel(slash[0] ?? '');
    if (slash.length === 2) {
      if (args.length !== 3) return null;
      alphaRaw = slash[1];
    } else if (args.length !== 3) {
      return null;
    }
  }
  let a = 1;
  if (alphaRaw !== null) {
    // Alpha is a number in [0,1] or a percentage (css-color-4 §4.2) — the
    // scale is independent of the rgb()/hsl() function kind.
    const alpha = parseColorComponent(alphaRaw.trim(), 1);
    if (alpha === null) return null;
    a = Math.max(0, Math.min(1, alpha));
  }
  if (kind === 'rgb') {
    if (args.length !== 3) return null;
    const c: number[] = [];
    for (const rawArg of args) {
      const v = parseColorComponent(rawArg.trim(), 255);
      if (v === null) return null;
      c.push(Math.round(Math.max(0, Math.min(255, v))));
    }
    return { r: c[0], g: c[1], b: c[2], a };
  }
  if (args.length !== 3) return null;
  const hue = parseHue(args[0].trim());
  if (hue === null) return null;
  const ch = (rawArg: string): number | null => {
    const m = rawArg.match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)%?$/);
    if (!m) return null;
    return Math.max(0, Math.min(100, parseFloat(m[1])));
  };
  const sat = ch(args[1].trim());
  const light = ch(args[2].trim());
  if (sat === null || light === null) return null;
  const { r, g, b } = hslToRgb(hue, sat, light);
  return { r, g, b, a };
}

/**
 * One rgb() component: a number resolved against `scale` (255 for channels,
 * 1 for alpha) or a percentage resolved against 100 then scaled (css-color-4
 * §4.2). Returns the clamped-to-range value; null on unparseable input.
 */
function parseColorComponent(raw: string, scale: number): number | null {
  const m = raw.match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)(%)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  return m[2] ? (v / 100) * scale : v;
}

/** Hue angle: unitless degrees or deg/rad/grad/turn, normalized mod 360. */
function parseHue(raw: string): number | null {
  const m = raw.match(/^([+-]?[\d.]+(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  const unit = m[2] ?? 'deg';
  const deg = unit === 'rad' ? (v * 180) / Math.PI : unit === 'grad' ? v * 0.9 : unit === 'turn' ? v * 360 : v;
  return ((deg % 360) + 360) % 360;
}

function hslToRgb(hDeg: number, sPct: number, lPct: number): { r: number; g: number; b: number } {
  const h = hDeg / 360;
  const s = sPct / 100;
  const l = lPct / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 1 / 6) {
    r = c;
    g = x;
  } else if (h < 2 / 6) {
    r = x;
    g = c;
  } else if (h < 3 / 6) {
    g = c;
    b = x;
  } else if (h < 4 / 6) {
    g = x;
    b = c;
  } else if (h < 5 / 6) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round(Math.max(0, Math.min(1, r + m)) * 255),
    g: Math.round(Math.max(0, Math.min(1, g + m)) * 255),
    b: Math.round(Math.max(0, Math.min(1, b + m)) * 255),
  };
}

export function parseColor(input: string): Color {
  return parseColorOrNull(input) ?? { r: 0, g: 0, b: 0, a: 1 };
}

/** Resolve the currentColor sentinel against the element's computed color. */
export function resolveCurrentColor(c: Color, elementColor: Color): Color {
  return c.currentColor ? elementColor : c;
}

/**
 * Parse one box-shadow / text-shadow value (css-backgrounds-3 §7.1,
 * css-text-decor-3 §7). A comma-separated list becomes a shadow per item, each
 * item's tokens are `inset? && <length>{2,4} && <color>?` with the color
 * allowed anywhere; a missing color is `currentColor` (the element's color).
 * text-shadow shares the grammar minus `inset` and the 4th (spread) length.
 * Returns null when any token fails to parse (an unparseable color or length
 * invalidates the whole declaration, like Chrome's parse-error recovery).
 */
export function parseShadowList(value: string, currentColor: Color): Shadow[] | null {
  const parts = splitOnTopLevelComma(value);
  const out: Shadow[] = [];
  for (const part of parts) {
    const tokens = splitTopLevel(part);
    let inset = false;
    const lenses: string[] = [];
    let color: Color | null = null;
    for (const t of tokens) {
      if (t === 'inset') {
        inset = true;
        continue;
      }
      const parsed = parseColorOrNull(t);
      if (parsed) {
        color = resolveCurrentColor(parsed, currentColor);
        continue;
      }
      if (/^(calc|min|max|clamp)\(/i.test(t) || /^[-+\d.]/.test(t)) {
        lenses.push(t);
        continue;
      }
      return null;
    }
    const lens = lenses.map((t) => parseLength(t));
    out.push({
      inset,
      x: lens[0] ?? pxLength(0),
      y: lens[1] ?? pxLength(0),
      blur: lens[2] ?? pxLength(0),
      spread: lens[3] ?? pxLength(0),
      color: color ?? currentColor,
    });
  }
  return out;
}

export function parseLength(raw: string): Length {
  const s = raw.trim();
  if (s === 'auto') return AUTO;
  // Value functions parse through the single math resolver; an invalid or
  // dimensionless result (e.g. calc(2*3)) drops like Chrome's declaration.
  // rem (the root font-size constant) routes the same way so it composes with
  // calc()'s unit mixing.
  if (/^(?:calc|min|max|clamp)\(/i.test(s) || /^-?[\d.]+rem$/.test(s)) {
    const expr = parseMathValue(s);
    if (expr && !expr.pure) {
      return { px: null, pct: null, vw: null, vh: null, vmin: null, vmax: null, em: null, calc: expr, auto: false };
    }
    return AUTO;
  }
  const m = s.match(/^(-?[\d.]+)(px|em|%|vw|vh|vmin|vmax)?$/);
  if (m) {
    const v = parseFloat(m[1]);
    switch (m[2] ?? 'px') {
      case 'em':
        return { px: null, pct: null, vw: null, vh: null, vmin: null, vmax: null, em: v, auto: false };
      case '%':
        return { px: null, pct: v, vw: null, vh: null, vmin: null, vmax: null, em: null, auto: false };
      case 'vw':
        return { px: null, pct: null, vw: v, vh: null, vmin: null, vmax: null, em: null, auto: false };
      case 'vh':
        return { px: null, pct: null, vw: null, vh: v, vmin: null, vmax: null, em: null, auto: false };
      case 'vmin':
        return { px: null, pct: null, vw: null, vh: null, vmin: v, vmax: null, em: null, auto: false };
      case 'vmax':
        return { px: null, pct: null, vw: null, vh: null, vmin: null, vmax: v, em: null, auto: false };
      default:
        return { px: v, pct: null, vw: null, vh: null, vmin: null, vmax: null, em: null, auto: false };
    }
  }
  return AUTO;
}

function parseRadiusPair(value: string): CornerRadii {
  const parts = splitTopLevel(value.trim());
  const rx = parts[0] !== undefined ? parseLength(parts[0]) : pxLength(0);
  const ry = parts[1] !== undefined ? parseLength(parts[1]) : rx;
  return { rx, ry };
}

/**
 * Expand a 1-4 value radius list into the four corners in TL/TR/BR/BL order
 * (CSS Backgrounds §4.3): 1 value → all, 2 → (a,b) with BR=TL and BL=TR,
 * 3 → (a,b,c) with BL=TR, 4 → as written.
 */
function expandRadiusList(list: Length[]): [Length, Length, Length, Length] {
  const v0 = list[0] ?? pxLength(0);
  const v1 = list[1] ?? v0;
  const v2 = list[2] ?? v0;
  const v3 = list[3] ?? v1;
  return [v0, v1, v2, v3];
}

function splitTopLevelBy(value: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of value) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseRadiusShorthand(value: string): { rx: Length[]; ry: Length[] } {
  const parts = splitTopLevelBy(value, '/');
  const horizRaw = parts[0] ?? '';
  const vertRaw = parts[1] ?? '';
  const rx = splitTopLevel(horizRaw).map(parseLength);
  const ry = vertRaw.trim() === '' ? rx : splitTopLevel(vertRaw).map(parseLength);
  return { rx, ry };
}

const RADIUS_LONGHANDS: Record<string, keyof BorderRadius> = {
  'border-top-left-radius': 'topLeft',
  'border-top-right-radius': 'topRight',
  'border-bottom-right-radius': 'bottomRight',
  'border-bottom-left-radius': 'bottomLeft',
};

function parseBorderRadius(decls: Declaration[]): BorderRadius {
  const out: BorderRadius = {
    topLeft: ZERO_RADIUS,
    topRight: ZERO_RADIUS,
    bottomRight: ZERO_RADIUS,
    bottomLeft: ZERO_RADIUS,
  };
  const shorthand = findDecl(decls, 'border-radius');
  if (shorthand) {
    const { rx, ry } = parseRadiusShorthand(shorthand.value);
    const [tlx, trx, brx, blx] = expandRadiusList(rx);
    const [tly, try_, bry, bly] = expandRadiusList(ry);
    out.topLeft = { rx: tlx, ry: tly };
    out.topRight = { rx: trx, ry: try_ };
    out.bottomRight = { rx: brx, ry: bry };
    out.bottomLeft = { rx: blx, ry: bly };
  }
  for (const [prop, corner] of Object.entries(RADIUS_LONGHANDS)) {
    const d = findDecl(decls, prop);
    if (d) out[corner] = parseRadiusPair(d.value);
  }
  return out;
}

function splitTopLevel(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of value) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (/\s/.test(c) && depth === 0) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function parseFixedOrPct(raw: string): Length | null {
  const s = raw.trim();
  if (/^-?[\d.]+px$/.test(s)) return { px: parseFloat(s), pct: null, vw: null, vh: null, vmin: null, vmax: null, em: null, auto: false };
  if (/^-?[\d.]+%$/.test(s)) return { px: null, pct: parseFloat(s), vw: null, vh: null, vmin: null, vmax: null, em: null, auto: false };
  return null;
}

function parseTrackFunction(raw: string): TrackFunction {
  const s = raw.trim();
  if (s.startsWith('fit-content(') && s.endsWith(')')) {
    const limit = parseFixedOrPct(s.slice('fit-content('.length, -1)) ?? parseLength(s.slice('fit-content('.length, -1));
    return { type: 'fit-content', limit };
  }
  if (/^(?:calc|min|max|clamp)\(/.test(s)) {
    const len = parseLength(s);
    if (len.calc) return { type: 'calc', len };
    return { type: 'auto' };
  }
  if (/^-?[\d.]+fr$/.test(s)) return { type: 'flex', flex: parseFloat(s) };
  if (/^-?[\d.]+px$/.test(s)) return { type: 'fixed', px: parseFloat(s) };
  if (/^-?[\d.]+%$/.test(s)) return { type: 'pct', pct: parseFloat(s) };
  if (s === 'auto') return { type: 'auto' };
  if (s === 'min-content') return { type: 'min-content' };
  if (s === 'max-content') return { type: 'max-content' };
  return { type: 'auto' };
}

/** Normalize a bare track-size value into min/max functions (spec §7.2.4). */
function bareTrackDef(t: TrackFunction): TrackDef {
  switch (t.type) {
    case 'fixed':
    case 'pct':
    case 'calc':
      return { min: t, max: t, names: [] };
    case 'flex':
      return { min: { type: 'auto' }, max: t, names: [] };
    case 'auto':
      return { min: { type: 'auto' }, max: { type: 'auto' }, names: [] };
    case 'min-content':
      return { min: { type: 'min-content' }, max: { type: 'max-content' }, names: [] };
    case 'max-content':
      return { min: { type: 'auto' }, max: { type: 'max-content' }, names: [] };
    case 'fit-content':
      return { min: { type: 'auto' }, max: t, names: [] };
  }
}

/** Decompose minmax(min, max) into a TrackDef, applying §7.2.4 normalization. */
function minmaxTrackDef(min: TrackFunction, max: TrackFunction): TrackDef {
  const d = { min, max, names: [] } as TrackDef;
  if (min.type === 'flex') {
    d.min = { type: 'auto' };
    return d;
  }
  const fixedPx = (fn: TrackFunction): number | null => (fn.type === 'fixed' ? fn.px : null);
  const minPx = fixedPx(min);
  const maxPx = fixedPx(max);
  if (minPx !== null && maxPx !== null && maxPx < minPx) {
    d.max = min;
  }
  return d;
}

function parseTrackDef(tok: string): TrackDef {
  const s = tok.trim();
  if (s.startsWith('minmax(') && s.endsWith(')')) {
    const parts = splitOnTopLevelComma(s.slice('minmax('.length, -1));
    if (parts.length === 2) {
      const min = parseTrackFunction(parts[0]);
      const max = parseTrackFunction(parts[1]);
      return minmaxTrackDef(min, max);
    }
  }
  return bareTrackDef(parseTrackFunction(s));
}

function splitOnTopLevelComma(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of value) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Parse `grid-template-columns/rows` value into a GridTemplate (repeat() with a
 * fixed count expanded; auto-fill/auto-fit left as-is for the caller to expand).
 */
export function parseTrackList(value: string): GridTemplate | null {
  const s = value.trim();
  if (s === '' || s === 'none') return null;
  const tokens = splitTopLevel(s);
  const tracks: TrackDef[] = [];
  const lineNames = new Map<number, string[]>();
  let line = 1;
  for (const tok of tokens) {
    if (tok.startsWith('[') && tok.endsWith(']')) {
      const names = tok.slice(1, -1).split(/\s+/).filter(Boolean);
      if (names.length) lineNames.set(line, [...(lineNames.get(line) ?? []), ...names]);
      continue;
    }
    if (tok.startsWith('repeat(') && tok.endsWith(')')) {
      const body = tok.slice('repeat('.length, -1);
      const parts = splitOnTopLevelComma(body);
      if (parts.length !== 2) continue;
      const countRaw = parts[0].trim();
      if (/^auto-(fill|fit)$/.test(countRaw)) continue; // auto-repeat handled by caller
      const count = /^\d+$/.test(countRaw) ? parseInt(countRaw, 10) : 0;
      const innerTokens = splitTopLevel(parts[1]);
      for (let i = 0; i < count; i++) {
        for (const it of innerTokens) {
          if (it.startsWith('[') && it.endsWith(']')) {
            const names = it.slice(1, -1).split(/\s+/).filter(Boolean);
            if (names.length) lineNames.set(line, [...(lineNames.get(line) ?? []), ...names]);
            continue;
          }
          tracks.push(parseTrackDef(it));
          line++;
        }
      }
      continue;
    }
    tracks.push(parseTrackDef(tok));
    line++;
  }
  return { tracks, areas: null, areasByName: new Map(), lineNames };
}

export function parseTemplateAreas(value: string): { areas: string[][] | null; areasByName: Map<string, NamedArea> } {
  // Extract quoted strings; each string is one row of cells. CSS allows both
  // single and double quotes.
  const re = /"([^"]*)"|'([^']*)'/g;
  const rows: string[][] = [];
  let width = -1;
  let m: RegExpExecArray | null = re.exec(value);
  while (m !== null) {
    const raw = m[1] ?? m[2];
    const cells = raw.trim().split(/\s+/).filter(Boolean);
    if (cells.length === 0) return { areas: null, areasByName: new Map() };
    if (width === -1) width = cells.length;
    else if (cells.length !== width) return { areas: null, areasByName: new Map() };
    rows.push(cells);
    m = re.exec(value);
  }
  if (rows.length === 0) return { areas: null, areasByName: new Map() };

  const areasByName = new Map<string, NamedArea>();
  const place = (name: string, r: number, c: number) => {
    const existing = areasByName.get(name);
    if (!existing) {
      areasByName.set(name, { rowStart: r + 1, colStart: c + 1, rowEnd: r + 2, colEnd: c + 2 });
      return;
    }
    existing.rowStart = Math.min(existing.rowStart, r + 1);
    existing.colStart = Math.min(existing.colStart, c + 1);
    existing.rowEnd = Math.max(existing.rowEnd, r + 2);
    existing.colEnd = Math.max(existing.colEnd, c + 2);
  };
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      if (cell !== '.' && cell !== '...') place(cell, r, c);
    }
  }
  for (const [name, a] of areasByName) {
    const cols = a.colEnd - a.colStart;
    const rowsN = a.rowEnd - a.rowStart;
    for (let r = a.rowStart - 1; r < a.rowEnd - 1; r++) {
      for (let c = a.colStart - 1; c < a.colEnd - 1; c++) {
        if ((rows[r] ?? [])[c] !== name) return { areas: null, areasByName: new Map() };
      }
    }
    void cols;
    void rowsN;
  }
  return { areas: rows, areasByName };
}

function parseGridLine(value: string): GridLineSpec {
  const s = value.trim();
  if (s === 'auto') return { kind: 'auto' };
  const span = s.match(/^span(?:\s+(\d+))?(?:\s+([a-zA-Z_-][\w-]*))?$/);
  if (span) {
    const count = span[1] ? parseInt(span[1], 10) : 1;
    const name = span[2];
    return name ? { kind: 'span', count, name } : { kind: 'span', count };
  }
  const int = s.match(/^(-?\d+)(?:\s+([a-zA-Z_-][\w-]*))?$/);
  if (int) {
    const value = parseInt(int[1], 10);
    if (value === 0) return { kind: 'auto' };
    const name = int[2];
    return name ? { kind: 'integer', value, name } : { kind: 'integer', value };
  }
  if (/^[a-zA-Z_-][\w-]*$/.test(s)) return { kind: 'name', value: s };
  return { kind: 'auto' };
}

function parseGridLinePair(value: string): { start: GridLineSpec; end: GridLineSpec } {
  const parts = value.split('/').map((p) => p.trim());
  if (parts.length === 1) {
    const first = parseGridLine(parts[0]);
    const end = first.kind === 'name' ? first : { kind: 'auto' as const };
    return { start: first, end };
  }
  return { start: parseGridLine(parts[0]), end: parseGridLine(parts[1]) };
}

function parseGridArea(value: string): GridPlacementSpecs {
  const parts = value.split('/').map((p) => p.trim());
  if (parts.length === 1) {
    const g = parseGridLine(parts[0]);
    return { rowStart: g, colStart: g, rowEnd: g, colEnd: g };
  }
  const get = (i: number): GridLineSpec => (parts[i] ? parseGridLine(parts[i]) : { kind: 'auto' });
  return { rowStart: get(0), colStart: get(1), rowEnd: get(2), colEnd: get(3) };
}

export interface GridPlacementSpecs {
  rowStart: GridLineSpec;
  rowEnd: GridLineSpec;
  colStart: GridLineSpec;
  colEnd: GridLineSpec;
}

function unescapeCssString(s: string): string {
  return s.replace(/\\([0-9a-fA-F]{1,6})\s?|\\/g, (_m, hex: string | undefined) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : '',
  );
}

/**
 * Parse the `content` property (generated content, CSS Generated Content §3).
 * `none`/`normal` (and empty) mean no generated box; string tokens concatenate
 * to the generated text. Other token types (attr(), url(), counter()) are out
 * of scope and fall back to none.
 */
function parseContent(value: string): ContentValue {
  const s = value.trim();
  if (s === '' || s === 'none' || s === 'normal') return { kind: 'none' };
  let out = '';
  let rest = s;
  let sawString = false;
  while (rest.length > 0) {
    const m = rest.match(/^\s*(['"])((?:\\.|(?!\1)[\s\S])*)\1/);
    if (!m) break;
    sawString = true;
    out += unescapeCssString(m[2]);
    rest = rest.slice(m[0].length);
  }
  return sawString ? { kind: 'text', text: out } : { kind: 'none' };
}

function contentOf(decls: Declaration[]): ContentValue {
  const d = findDecl(decls, 'content');
  return d ? parseContent(d.value) : { kind: 'none' };
}

function parseSelfAlign(value: string): SelfAlign {
  const s = value.trim();
  if (s === 'start' || s === 'flex-start' || s === 'self-start') return 'start';
  if (s === 'end' || s === 'flex-end' || s === 'self-end') return 'end';
  if (s === 'center') return 'center';
  if (s === 'baseline' || s === 'first baseline' || s === 'last baseline') return 'baseline';
  return 'stretch';
}

function parseContentAlign(value: string): ContentAlign {
  const s = value.trim();
  if (s === 'start' || s === 'flex-start') return 'start';
  if (s === 'end' || s === 'flex-end') return 'end';
  if (s === 'center') return 'center';
  if (s === 'space-between') return 'space-between';
  if (s === 'space-around') return 'space-around';
  if (s === 'space-evenly') return 'space-evenly';
  if (s === 'stretch') return 'stretch';
  return 'normal';
}

function parseBoxShorthand(raw: string): Record<Side, Length> {
  const parts = splitTopLevel(raw).map(parseLength);
  const [t = AUTO, r = t, b = t, l = r] = parts;
  return { top: t, right: r, bottom: b, left: l };
}

type BorderStyleKeyword = 'none' | 'solid' | 'inset' | 'outset';

const BORDER_WIDTH_KEYWORDS: Record<string, number> = { thin: 1, medium: 3, thick: 5 };

/**
 * Tokenize a border shorthand's value into width/style/color. Tokens split
 * paren-aware so a modern `rgb(10 20 30)` color survives. Returns null when
 * any token is unparseable — an invalid component invalidates the whole
 * shorthand like Chrome (the declaration drops entirely, not token-by-token).
 */
function parseBorderShorthandParts(
  raw: string,
  defaultColor: Color,
): { width: number; style: BorderStyleKeyword; color: Color } | null {
  let width = 0;
  let style: BorderStyleKeyword = 'solid';
  let color: Color | null = null;
  let sawWidth = false;
  for (const p of splitTopLevel(raw.trim())) {
    if (p === 'solid' || p === 'none' || p === 'inset' || p === 'outset') {
      style = p;
      continue;
    }
    if (/^-?[\d.]+px$/.test(p)) {
      width = parseFloat(p);
      sawWidth = true;
      continue;
    }
    if (!sawWidth && p in BORDER_WIDTH_KEYWORDS) {
      width = BORDER_WIDTH_KEYWORDS[p];
      sawWidth = true;
      continue;
    }
    const c = parseColorOrNull(p);
    if (c) {
      color = c;
      continue;
    }
    return null;
  }
  return { width, style, color: color ? resolveCurrentColor(color, defaultColor) : defaultColor };
}

function parseBorderStyleShorthand(raw: string): Record<Side, BorderStyleKeyword> {
  const kw = (v: string): BorderStyleKeyword =>
    v === 'inset' ? 'inset' : v === 'outset' ? 'outset' : v === 'solid' ? 'solid' : 'none';
  const parts = raw.trim().split(/\s+/).map(kw);
  const [t = 'none', r = t, b = t, l = r] = parts;
  return { top: t, right: r, bottom: b, left: l };
}

function parseBorderColorShorthand(raw: string): Record<Side, Color> | null {
  const parts = splitTopLevel(raw.trim()).map(parseColorOrNull);
  if (parts.some((p) => p === null)) return null;
  const [t = parseColor('black'), r = t, b = t, l = r] = parts as Color[];
  return { top: t, right: r, bottom: b, left: l };
}

function parseFlexBasis(value: string | undefined): Length {
  if (!value) return AUTO;
  const s = value.trim();
  if (s === 'auto' || s === 'content') return AUTO;
  return parseLength(s);
}

/**
 * Parse the `flex` shorthand per css-flexbox-1 §7.1.1. A lone number sets
 * flex-grow with flex-shrink 1 and flex-basis 0%.
 */
function parseFlexShorthand(value: string): { grow: number; shrink: number; basis: Length } {
  const parts = splitTopLevel(value.trim());
  const isNum = (s: string): boolean => /^[\d.]+$/.test(s);
  const isLen = (s: string): boolean => /^[\d.]+(?:px|%|em|rem)$/.test(s) || /^(?:calc|min|max|clamp)\(/.test(s) || s === 'auto' || s === 'content';
  const auto = AUTO;
  const zero = pxLength(0);
  const basisOf = (s: string): Length => (s === 'auto' || s === 'content' ? auto : parseLength(s));

  if (parts.length === 1) {
    const p = parts[0];
    if (p === 'none') return { grow: 0, shrink: 0, basis: auto };
    if (p === 'auto') return { grow: 1, shrink: 1, basis: auto };
    if (p === 'initial') return { grow: 0, shrink: 1, basis: auto };
    if (isNum(p)) return { grow: parseFloat(p), shrink: 1, basis: zero };
    return { grow: 1, shrink: 1, basis: basisOf(p) };
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    if (isNum(a) && isNum(b)) return { grow: parseFloat(a), shrink: parseFloat(b), basis: zero };
    if (isNum(a) && isLen(b)) return { grow: parseFloat(a), shrink: 1, basis: basisOf(b) };
    if (isLen(a) && isNum(b)) return { grow: parseFloat(b), shrink: 1, basis: basisOf(a) };
    return { grow: isNum(a) ? parseFloat(a) : 1, shrink: isNum(b) ? parseFloat(b) : 1, basis: isLen(a) ? basisOf(a) : isLen(b) ? basisOf(b) : zero };
  }
  const grow = parts[0] !== undefined && isNum(parts[0]) ? parseFloat(parts[0]) : 1;
  const shrink = parts[1] !== undefined && isNum(parts[1]) ? parseFloat(parts[1]) : 1;
  const basis = parts[2] !== undefined ? basisOf(parts[2]) : zero;
  return { grow, shrink, basis };
}

/** Split a declaration block on top-level semicolons (quote-aware; a ';' inside
 * a string never splits). */
function splitDeclarations(block: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < block.length) {
        cur += block[i + 1];
        i++;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ';' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

export interface Declaration {
  property: string;
  value: string;
  /** UA "quirky" margin marker (Blink's `__qem` on margin-block-start). */
  quirk?: boolean;
}

export function parseDeclarationBlock(block: string): Declaration[] {
  return splitDeclarations(block)
    .map((d) => {
      const idx = d.indexOf(':');
      if (idx < 0) return null;
      const name = d.slice(0, idx).trim();
      // Custom property names are case-sensitive (css-variables-1 §2) and must
      // not fold; regular property names are ASCII case-insensitive.
      return {
        property: name.startsWith('--') ? name : name.toLowerCase(),
        value: d.slice(idx + 1).trim(),
      };
    })
    .filter((d): d is Declaration => d !== null);
}

export function parseStyleAttribute(style: string | undefined): Declaration[] {
  if (!style) return [];
  return parseDeclarationBlock(style);
}

/**
 * makeStyle's single property lookup choke point: registers the looked-up
 * property name for the coverage audit, then returns the first declaration for
 * that property (the makeStyle cascade winner). Auditing here is the only way
 * to know which declared properties the engine actually consumes without a
 * hand-maintained list diverging from the code. Purely observational.
 */
function findDecl(decls: Declaration[], name: string): Declaration | undefined {
  registerRecognizedProperty(name);
  return decls.find((d) => d.property === name);
}

/** Like findDecl, but registers and matches against any of several candidate
 * names (used where one property resolves from multiple logical/physical
 * sources picked by `direction`). */
function findDeclAny(decls: Declaration[], names: string[]): Declaration | undefined {
  for (const n of names) registerRecognizedProperty(n);
  return decls.find((d) => names.includes(d.property));
}

const FONT_WEIGHT: Record<string, number> = {
  normal: 400,
  bold: 700,
  bolder: 700,
  lighter: 300,
};

/** `line-height: normal` resolves to the font's natural line height (rounded
 * hhea ascender + descender at the element's font size), matching Blink's
 * FontMetrics for the element's family. */
function normalLineHeight(fontFamily: string, fontSize: number): number {
  const m = fontMetricsForFamily(fontFamily);
  if (!m) return fontSize * 1.2;
  return roundedAscent(m, fontSize) + roundedDescent(m, fontSize);
}

function parseLineHeight(value: string, fontSize: number): number {
  const s = value.trim();
  if (s === 'normal') return fontSize * 1.2;
  if (s === 'inherit') return fontSize * 1.2;
  const m = s.match(/^(-?[\d.]+)(px)?$/);
  if (m) {
    const v = parseFloat(m[1]);
    return m[2] === 'px' ? v : v * fontSize;
  }
  return fontSize * 1.2;
}

function parseLetterSpacing(value: string): number {
  const s = value.trim();
  if (s === 'normal' || s === 'inherit') return 0;
  const m = s.match(/^(-?[\d.]+)(px)?$/);
  if (m) return parseFloat(m[1]);
  return 0;
}

function parseDecorationLines(value: string): DecorationLine[] {
  const s = value.trim();
  if (s === '' || s === 'none' || s === 'inherit') return [];
  const out: DecorationLine[] = [];
  if (s.includes('underline')) out.push('underline');
  if (s.includes('line-through')) out.push('line-through');
  if (s.includes('overline')) out.push('overline');
  return out;
}

function parseDecorationThickness(value: string): 'auto' | 'from-font' | { px: number } {
  const s = value.trim();
  if (s === 'auto' || s === 'inherit') return 'auto';
  if (s === 'from-font') return 'from-font';
  const m = s.match(/^(-?[\d.]+)(px)?$/);
  if (m) return { px: parseFloat(m[1]) };
  return 'auto';
}

function parsePxOffset(value: string): number {
  const s = value.trim();
  if (s === 'auto' || s === 'inherit') return 0;
  const m = s.match(/^(-?[\d.]+)(px)?$/);
  if (m) return parseFloat(m[1]);
  return 0;
}

function parseDecorationShorthand(value: string): {
  lines: DecorationLine[];
  color: Color | null;
  thickness: 'auto' | 'from-font' | { px: number };
} {
  const tokens = value.trim().split(/\s+/);
  const lines: DecorationLine[] = [];
  let color: Color | null = null;
  let thickness: 'auto' | 'from-font' | { px: number } = 'auto';
  for (const tok of tokens) {
    if (tok === 'underline' || tok === 'line-through' || tok === 'overline') {
      if (!lines.includes(tok)) lines.push(tok);
    } else if (tok === 'from-font') {
      thickness = 'from-font';
    } else if (tok === 'solid' || tok === 'double' || tok === 'dotted' || tok === 'dashed' || tok === 'wavy') {
      // solid only in scope; others fall back to solid
    } else {
      const m = tok.match(/^(-?[\d.]+)(px)?$/);
      if (m) {
        thickness = { px: parseFloat(m[1]) };
      } else if (color === null) {
        const c = parseColorOrNull(tok);
        if (c) color = c;
      }
    }
  }
  return { lines, color, thickness };
}

interface Defaults {
  fontFamily: string;
  /** the inherited (parent) font-size; a UA `font-size` multiplier resolves against it. */
  fontSize: number;
  color: Color;
  lineHeight: number | 'normal';
  display: DisplayValue;
  letterSpacing?: number;
  textDecorationLines?: DecorationLine[];
  textDecorationColor?: Color | null;
  textDecorationThickness?: 'auto' | 'from-font' | { px: number };
  textUnderlineOffset?: number;
  /** inherited text-shadows (text-shadow inherits; box-shadow does not). */
  textShadow?: Shadow[];
  fontWeightDefault?: number;
  fontStyleDefault?: 'normal' | 'italic';
  /** inherited list-style-type (default disc, matching the CSS initial). */
  listStyleTypeDefault?: ListStyleType;
  /** inherited list-style-position (default outside, matching the CSS initial). */
  listStylePositionDefault?: 'inside' | 'outside';
  paddingDefault?: Length;
  verticalAlignDefault?: VerticalAlign;
  /** UA-level default text-align (e.g. th gets 'center'); wins over inherited. */
  textAlignDefault?: TextAlign;
  textAlignInherited?: TextAlign;
  textAlignComputedInherited?: string;
  /** the inherited computed text-align keyword ('start'/'end'/'left'/'right'/
   * 'center'/'justify'), resolved against the element's own direction. */
  textAlignInheritedKeyword?: string;
  whiteSpaceDefault?: WhiteSpaceValue;
  textTransformInherited?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textIndentInherited?: Length;
  textIndentHangingInherited?: boolean;
  textIndentEachLineInherited?: boolean;
  wordSpacingInherited?: Length;
  borderCollapseDefault?: 'separate' | 'collapse';
  borderSpacingDefault?: number;
  borderSpacingVDefault?: number;
  tableLayoutDefault?: 'auto' | 'fixed';
  captionSideDefault?: 'top' | 'bottom';
  /** inherited `direction` (direction inherits; initial ltr). */
  directionInherited?: Direction;
  /**
   * The parent's computed custom properties (css-variables-1 §3): custom
   * properties inherit as resolved token streams, and var() substitution at
   * computed-value time reads this map (the element's own declarations win
   * per name).
   */
  customPropsInherited?: Record<string, string>;
}

/**
 * Substitute every top-level var() reference in a css-variables-1 §3 token
 * stream. `resolve` answers for one custom-property name: the resolved token
 * stream, null (guaranteed-invalid — cycles or an invalid reference), or
 * undefined (no such property). Fallbacks (everything after the first
 * top-level comma) substitute when the reference is null/undefined. Quoted
 * strings never substitute. Returns null when the value is invalid at
 * computed-value time (a var() with no usable substitution), which drops the
 * declaration like Chrome.
 */
function substituteVars(
  value: string,
  resolve: (name: string) => string | null | undefined,
): string | null {
  if (!/var\(/i.test(value)) return value;
  let out = '';
  let i = 0;
  const n = value.length;
  while (i < n) {
    const c = value[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) {
        if (value[j] === '\\' && j + 1 < n) j += 2;
        else if (value[j] === c) {
          j++;
          break;
        } else j++;
      }
      out += value.slice(i, j);
      i = j;
      continue;
    }
    if ((c === 'v' || c === 'V') && value.slice(i, i + 4).toLowerCase() === 'var(') {
      let depth = 0;
      let j = i + 3;
      while (j < n) {
        const d = value[j];
        if (d === '"' || d === "'") {
          j++;
          while (j < n) {
            if (value[j] === '\\') j += 2;
            else if (value[j] === d) {
              j++;
              break;
            } else j++;
          }
          continue;
        }
        if (d === '(') depth++;
        else if (d === ')') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (j >= n) return null;
      const inner = value.slice(i + 4, j);
      const comma = topLevelCommaIndex(inner);
      const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
      if (!name.startsWith('--')) return null;
      const ref = resolve(name);
      if (typeof ref === 'string') {
        out += ref;
      } else if (comma !== -1) {
        const fb = substituteVars(inner.slice(comma + 1), resolve);
        if (fb === null) return null;
        out += fb;
      } else {
        return null;
      }
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Index of the first comma at paren depth 0 outside strings, else -1. */
function topLevelCommaIndex(s: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return i;
  }
  return -1;
}

export function makeStyle(rawDecls: Declaration[], defaults: Defaults): ComputedStyle {
  // --- custom properties (css-variables-1): resolve own declarations against
  // the inherited map, then substitute var() in every remaining declaration.
  // A declaration whose substitution is invalid at computed-value time drops
  // (the property falls to its inherited/initial default, like Chrome). ---
  const inheritedCustom = defaults.customPropsInherited ?? {};
  const ownCustom: Record<string, string> = {};
  const plainDecls: Declaration[] = [];
  for (const d of rawDecls) {
    if (d.property.startsWith('--')) {
      if (!(d.property in ownCustom)) ownCustom[d.property] = d.value.trim();
    } else {
      plainDecls.push(d);
    }
  }
  const resolvedCustom: Record<string, string> = {};
  const invalidCustom = new Set<string>();
  const resolving = new Set<string>();
  const resolveCustom = (name: string): string | null | undefined => {
    if (name in resolvedCustom) return resolvedCustom[name];
    if (invalidCustom.has(name)) return null;
    if (!(name in ownCustom)) return inheritedCustom[name];
    if (resolving.has(name)) return null;
    resolving.add(name);
    const sub = substituteVars(ownCustom[name], resolveCustom);
    resolving.delete(name);
    if (sub === null) {
      invalidCustom.add(name);
      return null;
    }
    resolvedCustom[name] = sub.trim();
    return resolvedCustom[name];
  };
  for (const name of Object.keys(ownCustom)) resolveCustom(name);
  // Guaranteed-invalid own names block inheritance (children of an element
  // whose --x is invalid do not see the grandparent's --x either).
  const customProps: Record<string, string> = { ...inheritedCustom, ...resolvedCustom };
  for (const name of invalidCustom) delete customProps[name];
  const decls: Declaration[] = [];
  for (const d of plainDecls) {
    const sub = substituteVars(d.value, resolveCustom);
    if (sub === null || sub.trim() === '') continue;
    decls.push(sub === d.value ? d : { ...d, value: sub });
  }
  const transparentColor: Color = { r: 0, g: 0, b: 0, a: 0 };
  // The element's own color resolves first: every other color-consuming
  // position (background, borders, shadows, decorations) resolves currentColor
  // against it, and `color: currentcolor` resolves against the inherited color.
  const colorDecl = findDecl(decls, 'color');
  const elementColor = (() => {
    if (colorDecl) {
      const c = parseColorOrNull(colorDecl.value);
      if (c && !c.currentColor) return c;
    }
    return defaults.color;
  })();
  // A declaration whose color fails to parse drops (Chrome's parse-error
  // recovery), yielding the default — never the black fallback.
  const color = (name: string, dflt: Color): Color => {
    const v = findDecl(decls, name);
    if (v) {
      const c = parseColorOrNull(v.value);
      if (c) return c.currentColor ? elementColor : c;
    }
    return dflt;
  };

  const bgDecl = findDecl(decls, 'background-color') ?? findDecl(decls, 'background');

  // --- font-family (needed before line-height/font-size-margin resolution) ---
  let fontFamily = defaults.fontFamily;
  const ffDecl = findDecl(decls, 'font-family');
  if (ffDecl) {
    fontFamily =
      ffDecl.value
        .split(',')
        .map((f) => f.trim().replace(/^["']|["']$/g, ''))
        .find(Boolean) ?? fontFamily;
  }

  let fontSize = defaults.fontSize;
  const fontDecl = findDecl(decls, 'font');
  if (fontDecl) {
    const m = fontDecl.value.match(
      /(?:(\d+(?:\.\d+)?)px\s*(?:\/\s*(\d+(?:\.\d+)?))?)\s*["']?([^"']+?)["']?$/,
    );
    if (m) {
      fontSize = parseFloat(m[1]);
      if (m[3]) fontFamily = m[3].trim().replace(/,$/, '').trim();
    }
  }
  const fsDecl = findDecl(decls, 'font-size');
  if (fsDecl) {
    const m = fsDecl.value.trim().match(/^(-?[\d.]+)(px|em)?$/);
    if (m) {
      if (m[2] === 'em') fontSize = defaults.fontSize * parseFloat(m[1]);
      else fontSize = parseFloat(m[1]);
    }
  }

  let lineHeight: number;
  let lineHeightNormal = false;
  const lhDecl = findDecl(decls, 'line-height');
  const lhValue = lhDecl ? lhDecl.value.trim() : defaults.lineHeight;
  if (lhValue === 'normal') {
    lineHeightNormal = true;
    lineHeight = normalLineHeight(fontFamily, fontSize);
  } else if (lhValue === 'inherit') {
    if (typeof defaults.lineHeight === 'number') {
      lineHeight = defaults.lineHeight;
    } else {
      lineHeightNormal = true;
      lineHeight = normalLineHeight(fontFamily, fontSize);
    }
  } else if (typeof lhValue === 'number') {
    lineHeight = lhValue;
  } else {
    lineHeight = parseLineHeight(lhValue, fontSize);
  }

  // --- font-weight / font-style (inherited, UA `bolder` maps 400→700, 700→900) ---
  const fontWeight = (() => {
    const d = findDecl(decls, 'font-weight');
    if (!d) return defaults.fontWeightDefault ?? 400;
    const v = d.value.trim();
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (v === 'bolder') return (defaults.fontWeightDefault ?? 400) <= 400 ? 700 : 900;
    if (v === 'lighter') return (defaults.fontWeightDefault ?? 400) >= 700 ? 400 : 300;
    return FONT_WEIGHT[v] ?? defaults.fontWeightDefault ?? 400;
  })();
  const fontStyle = (() => {
    const d = findDecl(decls, 'font-style');
    if (!d) return defaults.fontStyleDefault ?? 'normal';
    const v = d.value.trim();
    return v === 'italic' || v === 'oblique' ? 'italic' : 'normal';
  })();

  const listStyleType = (() => {
    // `list-style` shorthand sets type/position/image together; parse it here so
    // pages that write `list-style: none` (the ubiquitous "no bullets" reset)
    // don't silently keep disc markers.
    const sh = findDecl(decls, 'list-style');
    if (sh) {
      const parts = sh.value.trim().toLowerCase().split(/\s+/);
      for (const p of parts) {
        if (p === 'none' || p === 'disc' || p === 'circle' || p === 'square' || p === 'decimal' || p === 'decimal-leading-zero') return p;
      }
    }
    const d = findDecl(decls, 'list-style-type');
    if (!d) return defaults.listStyleTypeDefault ?? 'disc';
    const v = d.value.trim().toLowerCase();
    return v === 'none' || v === 'disc' || v === 'circle' || v === 'square' || v === 'decimal' || v === 'decimal-leading-zero' ? v : 'disc';
  })();

  const listStylePosition = (() => {
    const sh = findDecl(decls, 'list-style');
    if (sh) {
      if (sh.value.trim().toLowerCase().split(/\s+/).includes('inside')) return 'inside';
    }
    const d = findDecl(decls, 'list-style-position');
    if (!d) return defaults.listStylePositionDefault ?? 'outside';
    const v = d.value.trim().toLowerCase();
    return v === 'inside' ? 'inside' : 'outside';
  })();

  const len = (name: string, dflt: Length = AUTO): Length => {
    const d = findDecl(decls, name);
    return d ? resolveEmLength(parseLength(d.value), fontSize) : dflt;
  };

  // Resolve one physical inset side from the longhands that feed it — the
  // physical longhand, the block/inline logical longhand mapped per
  // `direction` (css-logical-1 §2.4), and the `inset` shorthand — taking the
  // cascade winner among them (the first declaration in the winner-first list).
  const insetSide = (side: Side, dflt: Length = AUTO): Length => {
    const names: string[] = [side];
    if (side === 'top') names.push('inset-block-start');
    else if (side === 'bottom') names.push('inset-block-end');
    else if (side === 'left') names.push(direction === 'rtl' ? 'inset-inline-end' : 'inset-inline-start');
    else names.push(direction === 'rtl' ? 'inset-inline-start' : 'inset-inline-end');
    names.push('inset');
    const d = findDeclAny(decls, names);
    if (!d) return dflt;
    if (d.property === 'inset') return resolveEmLength(parseBoxShorthand(d.value)[side], fontSize);
    return resolveEmLength(parseLength(d.value), fontSize);
  };

  const sideLens = (shorthand: string): Record<Side, Length> => {
    const sh = findDecl(decls, shorthand);
    const dflt = shorthand === 'padding' ? defaults.paddingDefault ?? pxLength(0) : pxLength(0);
    const top = len(`${shorthand}-top`, dflt);
    const right = len(`${shorthand}-right`, dflt);
    const bottom = len(`${shorthand}-bottom`, dflt);
    const left = len(`${shorthand}-left`, dflt);
    if (sh) return parseBoxShorthand(sh.value);
    return { top, right, bottom, left };
  };

  // `direction` (css-writing-modes-4 §2.2): inherited, initial ltr. Resolved
  // first so the logical→physical mappings below (margins, padding, insets,
  // text-align, float) can read it — the declaration never participates in
  // cascade order with the properties it maps.
  const direction: Direction = (() => {
    const d = findDecl(decls, 'direction');
    return d && d.value.trim() === 'rtl' ? 'rtl' : (defaults.directionInherited ?? 'ltr');
  })();

  // --- margins: each physical side takes its cascade winner among the
  // physical longhand, the logical longhand mapped per `direction`, and the
  // `margin` shorthand — the first declaration in the winner-first list
  // (shorthands expand to longhands at their own cascade position, so a
  // higher-specificity/later `margin-top` beats an earlier `margin`). The UA
  // margin-block-start carries the quirky-margin marker (Blink `__qem`). ---
  const margin = (() => {
    const side = (s: Side, inlineLogical: string): Length => {
      const d = findDeclAny(decls, [`margin-${s}`, inlineLogical, 'margin']);
      if (!d) return pxLength(0);
      if (d.property === 'margin') return parseBoxShorthand(d.value)[s];
      const l = parseLength(d.value);
      if ((s === 'top' || s === 'bottom') && d.property === `margin-block-${s === 'top' ? 'start' : 'end'}` && d.quirk) {
        l.quirk = true;
      }
      return l;
    };
    return {
      top: side('top', 'margin-block-start'),
      bottom: side('bottom', 'margin-block-end'),
      left: side('left', direction === 'rtl' ? 'margin-inline-end' : 'margin-inline-start'),
      right: side('right', direction === 'rtl' ? 'margin-inline-start' : 'margin-inline-end'),
    };
  })();

  // --- padding: the same cascade scan as margins (the inline logical
  // longhands feed the physical sides per `direction` — the inline-start side
  // holds the list gutter), falling back to the UA per-tag default. ---
  const padding = (() => {
    const dflt = defaults.paddingDefault ?? pxLength(0);
    const side = (s: Side, inlineLogical: string): Length => {
      const d = findDeclAny(decls, [`padding-${s}`, inlineLogical, 'padding']);
      if (!d) return dflt;
      if (d.property === 'padding') return parseBoxShorthand(d.value)[s];
      return parseLength(d.value);
    };
    return {
      top: side('top', 'padding-block-start'),
      bottom: side('bottom', 'padding-block-end'),
      left: side('left', direction === 'rtl' ? 'padding-inline-end' : 'padding-inline-start'),
      right: side('right', direction === 'rtl' ? 'padding-inline-start' : 'padding-inline-end'),
    };
  })();

  const resolveEm = (sides: Record<Side, Length>): Record<Side, Length> => ({
    top: resolveEmLength(sides.top, fontSize),
    right: resolveEmLength(sides.right, fontSize),
    bottom: resolveEmLength(sides.bottom, fontSize),
    left: resolveEmLength(sides.left, fontSize),
  });
  const marginResolved = resolveEm(margin);
  const paddingResolved = resolveEm(padding);

  const borderWidth: Record<Side, number> = { top: 0, right: 0, bottom: 0, left: 0 };
  // Default border color is currentColor (the element's color), like Blink.
  const borderColor: Record<Side, Color> = { top: elementColor, right: elementColor, bottom: elementColor, left: elementColor };
  const borderStyle: Record<Side, 'none' | 'solid' | 'inset' | 'outset'> = { top: 'none', right: 'none', bottom: 'none', left: 'none' };
  const borderRadius = (() => {
    const r = parseBorderRadius(decls);
    for (const corner of [r.topLeft, r.topRight, r.bottomRight, r.bottomLeft]) {
      corner.rx = resolveEmLength(corner.rx, fontSize);
      corner.ry = resolveEmLength(corner.ry, fontSize);
    }
    return r;
  })();
  const borderDecl = findDecl(decls, 'border');
  const bwShort = findDecl(decls, 'border-width');
  const bsShort = findDecl(decls, 'border-style');
  const bcShort = findDecl(decls, 'border-color');
  const borderShorthand = borderDecl ? parseBorderShorthandParts(borderDecl.value, elementColor) : null;
  if (borderShorthand) {
    if (borderShorthand.style !== 'none') {
      for (const s of SIDES) {
        borderWidth[s] = borderShorthand.width;
        borderColor[s] = borderShorthand.color;
        borderStyle[s] = borderShorthand.style;
      }
    }
  } else {
    const bw = bwShort ? parseBoxShorthand(bwShort.value) : null;
    const bs = bsShort ? parseBorderStyleShorthand(bsShort.value) : null;
    const bc = bcShort ? parseBorderColorShorthand(bcShort.value) : null;
    for (const s of SIDES) {
      // `border-<side>` is a four-in-one shorthand (width/style/color for that
      // side); parse it like the full `border` shorthand so pages that write
      // per-side borders (border-left, border-bottom, ...) get their width.
      // An invalid shorthand drops entirely and the longhands below decide.
      const sideShort = findDecl(decls, `border-${s}`);
      if (sideShort) {
        const parts = parseBorderShorthandParts(sideShort.value, elementColor);
        if (parts) {
          borderWidth[s] = parts.style === 'none' ? 0 : parts.width;
          borderColor[s] = parts.color;
          borderStyle[s] = parts.style;
          continue;
        }
      }
      const bw2 = bw ? bw[s] : len(`border-${s}-width`, pxLength(0));
      borderWidth[s] = bw2.px ?? 0;
      const c2 = bc ? bc[s] : color(`border-${s}-color`, elementColor);
      borderColor[s] = c2;
      borderStyle[s] = bs ? bs[s] : (() => {
        const d = findDecl(decls, `border-${s}-style`);
        const v = d ? d.value.trim() : '';
        if (v === 'inset') return 'inset';
        if (v === 'outset') return 'outset';
        if (v === 'solid') return 'solid';
        return 'none';
      })();
    }
  }

  const displayDecl = findDecl(decls, 'display');
  const display: DisplayValue = (() => {
    if (!displayDecl) return defaults.display;
    const v = displayDecl.value.trim();
    if (v === 'none') return 'none';
    if (v === 'contents') return 'contents';
    if (v === 'grid') return 'grid';
    if (v === 'inline-grid') return 'grid';
    if (v === 'flex' || v === 'inline-flex') return 'flex';
    if (v === 'inline-block') return 'inline-block';
    if (v === 'inline') return 'inline';
    if (v === 'list-item') return 'list-item';
    if (v === 'table') return 'table';
    if (v === 'inline-table') return 'inline-table';
    if (v === 'table-row') return 'table-row';
    if (v === 'table-cell') return 'table-cell';
    if (v === 'table-header-group') return 'table-header-group';
    if (v === 'table-footer-group') return 'table-footer-group';
    if (v === 'table-row-group') return 'table-row-group';
    if (v === 'table-column-group') return 'table-column-group';
    if (v === 'table-column') return 'table-column';
    if (v === 'table-caption') return 'table-caption';
    return 'block';
  })();

  const floatDecl = findDecl(decls, 'float');
  const positionDecl = findDecl(decls, 'position');
  const position: 'static' | 'relative' | 'sticky' | 'absolute' | 'fixed' = (() => {
    if (!positionDecl) return 'static';
    const v = positionDecl.value.trim();
    if (v === 'relative') return 'relative';
    // position: sticky computes to its own keyword; the layout treatement
    // (in-flow, constraint pass at scroll 0) lives in block-inline.ts.
    if (v === 'sticky') return 'sticky';
    if (v === 'absolute') return 'absolute';
    if (v === 'fixed') return 'fixed';
    return 'static';
  })();
  // CSS 2.1 §9.7: float computes to 'none' for abs/fixed positioned boxes.
  // The logical keywords float:inline-start/end compute to the physical side
  // per `direction` (css-logical-1 §4), mirroring Blink's computed value.
  let float: 'none' | 'left' | 'right' = (() => {
    const v = floatDecl?.value.trim();
    if (v === 'left' || v === 'inline-start') return direction === 'rtl' && v === 'inline-start' ? 'right' : 'left';
    if (v === 'right' || v === 'inline-end') return direction === 'rtl' && v === 'inline-end' ? 'left' : 'right';
    return 'none';
  })();
  if (position === 'absolute' || position === 'fixed') float = 'none';

  const zIndexDecl = findDecl(decls, 'z-index');
  const zIndex: number | null =
    zIndexDecl && /^-?\d+$/.test(zIndexDecl.value.trim()) ? parseInt(zIndexDecl.value.trim(), 10) : null;

  const clearDecl = findDecl(decls, 'clear');
  const clear: 'none' | 'left' | 'right' | 'both' = (() => {
    const v = clearDecl?.value.trim();
    if (v === 'left' || v === 'inline-start') return direction === 'rtl' && v === 'inline-start' ? 'right' : 'left';
    if (v === 'right' || v === 'inline-end') return direction === 'rtl' && v === 'inline-end' ? 'left' : 'right';
    if (v === 'both') return 'both';
    return 'none';
  })();

  const verticalAlignDecl = findDecl(decls, 'vertical-align');
  const verticalAlign: VerticalAlign = verticalAlignDecl
    ? (verticalAlignDecl.value.trim() as VerticalAlign)
    : (defaults.verticalAlignDefault ?? 'baseline');

  const textAlignDecl = findDecl(decls, 'text-align');
  // The inherited text-align is its *computed* keyword (start/end/left/...),
  // not the parent's used physical edge: css-text-3 inherits the computed
  // value, so an element with no declaration resolves the inherited keyword
  // against its OWN direction (an RTL child of an LTR subtree still aligns
  // start → right).
  const textAlignInheritedKeyword = defaults.textAlignInheritedKeyword ?? 'start';
  const usedFromKeyword = (kw: string): TextAlign => {
    if (kw === 'start') return direction === 'rtl' ? 'right' : 'left';
    if (kw === 'end') return direction === 'rtl' ? 'left' : 'right';
    // match-parent computes to the parent's alignment resolved against the
    // parent's direction (css-text-3 §4.2) — the parent's used value, which is
    // never itself match-parent, so resolving from it terminates.
    if (kw === 'match-parent') {
      return defaults.textAlignInherited ?? usedFromKeyword(textAlignInheritedKeyword);
    }
    if (kw === 'center' || kw === 'justify' || kw === 'right' || kw === 'left') return kw as TextAlign;
    return direction === 'rtl' ? 'right' : 'left';
  };
  // Used value: `start`/`end` resolve against the computed `direction`
  // (css-text-3 §4.2) — RTL maps start→right, end→left; `justify` carries
  // through as the used value for line stretching.
  const textAlign: TextAlign = textAlignDecl
    ? usedFromKeyword(textAlignDecl.value.trim())
    : (defaults.textAlignDefault ?? usedFromKeyword(textAlignInheritedKeyword));
  // Computed value matches Chrome's `getComputedStyle().textAlign` verbatim:
  // the authored keyword (start/end kept logical under LTR), else the inherited
  // computed value, else the UA default, else the initial `start` (CSS Text 3
  // changed the initial from CSS2.1's `left`; Chrome's computed initial is
  // 'start' while the used value stays left in LTR).
  const textAlignComputed: string = textAlignDecl
    ? textAlignDecl.value.trim()
    : defaults.textAlignDefault ?? defaults.textAlignComputedInherited ?? 'start';

  const borderCollapseDecl = findDecl(decls, 'border-collapse');
  const borderCollapse: 'separate' | 'collapse' =
    borderCollapseDecl && borderCollapseDecl.value.trim() === 'collapse' ? 'collapse' : (defaults.borderCollapseDefault ?? 'separate');
  const borderSpacingDecl = findDecl(decls, 'border-spacing');
  const parseSpacing = (): { h: number; v: number } => {
    if (borderSpacingDecl) {
      const parts = borderSpacingDecl.value.trim().split(/\s+/);
      const pxOf = (s: string | undefined): number => {
        if (!s) return 0;
        const m = s.trim().match(/^(-?[\d.]+)px$/);
        return m ? parseFloat(m[1]) : 0;
      };
      const h = pxOf(parts[0]);
      const v = pxOf(parts[1]) || h;
      return { h, v };
    }
    return { h: defaults.borderSpacingDefault ?? 0, v: defaults.borderSpacingVDefault ?? defaults.borderSpacingDefault ?? 0 };
  };
  const spacing = parseSpacing();
  const captionSideDecl = findDecl(decls, 'caption-side');
  const captionSide: 'top' | 'bottom' =
    captionSideDecl && captionSideDecl.value.trim() === 'bottom' ? 'bottom' : (defaults.captionSideDefault ?? 'top');
  const tableLayoutDecl = findDecl(decls, 'table-layout');
  const tableLayout: 'auto' | 'fixed' =
    tableLayoutDecl && tableLayoutDecl.value.trim() === 'fixed' ? 'fixed' : (defaults.tableLayoutDefault ?? 'auto');
  const emptyCellsDecl = findDecl(decls, 'empty-cells');
  const emptyCells: 'show' | 'hide' =
    emptyCellsDecl && emptyCellsDecl.value.trim() === 'hide' ? 'hide' : 'show';

  const boxSizingDecl = findDecl(decls, 'box-sizing');
  const boxSizing: 'content-box' | 'border-box' =
    boxSizingDecl && boxSizingDecl.value.trim() === 'border-box' ? 'border-box' : 'content-box';

  const overflowDecl = findDecl(decls, 'overflow');
  const overflow: OverflowValue = (() => {
    const v = overflowDecl?.value.trim() ?? '';
    if (v === 'visible' || v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll') return v;
    // Unknown keyword or a two-axis shorthand (overflow: x y) outside the
    // single-axis model: fall back to the initial value like Chrome does for
    // an invalid value.
    return 'visible';
  })();

  const wsDecl = findDecl(decls, 'white-space');
  let whiteSpace: WhiteSpaceValue = wsDecl
    ? (wsDecl.value.trim() as WhiteSpaceValue)
    : (defaults.whiteSpaceDefault ?? 'normal');
  if (whiteSpace !== 'normal' && whiteSpace !== 'nowrap' && whiteSpace !== 'pre' && whiteSpace !== 'pre-wrap' && whiteSpace !== 'pre-line') {
    // Unknown / out-of-scope keyword: fall back to the inherited default
    // (Chrome computes unknown values to `normal` for the legacy property).
    whiteSpace = defaults.whiteSpaceDefault ?? 'normal';
  }

  // css-text-3 §6: word-break (word-wrap is a legacy alias for overflow-wrap,
  // so both names feed the same cascade winner). Invalid keywords fall back to
  // the initial value like Chrome's computed-value fallback.
  // css-text-3 §2/§8: text-transform, text-indent (with the hanging/each-line
  // keywords Chrome keeps in the computed value) and word-spacing (the legacy
  // 'normal' computes to 0px). All three inherit.
  const textTransformDecl = findDecl(decls, 'text-transform');
  const textTransformRaw = textTransformDecl?.value.trim();
  const textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize' =
    textTransformRaw === 'uppercase' || textTransformRaw === 'lowercase' || textTransformRaw === 'capitalize'
      ? textTransformRaw
      : defaults.textTransformInherited ?? 'none';
  const textIndentDecl = findDecl(decls, 'text-indent');
  let textIndent = defaults.textIndentInherited ?? pxLength(0);
  let textIndentHanging = defaults.textIndentHangingInherited ?? false;
  let textIndentEachLine = defaults.textIndentEachLineInherited ?? false;
  if (textIndentDecl) {
    const tokens = textIndentDecl.value.trim().split(/\s+/).filter(Boolean);
    const lengthTokens = tokens.filter((t) => t !== 'hanging' && t !== 'each-line');
    if (lengthTokens.length === 1) {
      const l = parseLength(lengthTokens[0]);
      if (l.px !== null || l.pct !== null || l.em !== null) textIndent = resolveEmLength(l, fontSize);
      else if (l.auto) textIndent = pxLength(0);
      textIndentHanging = tokens.includes('hanging');
      textIndentEachLine = tokens.includes('each-line');
    }
  }
  const wordSpacingDecl = findDecl(decls, 'word-spacing');
  const wordSpacingRaw = wordSpacingDecl?.value.trim();
  const wordSpacing: Length =
    wordSpacingRaw && wordSpacingRaw !== 'normal'
      ? (() => {
          const l = parseLength(wordSpacingRaw);
          if (l.pct !== null) return pxLength((l.pct / 100) * fontSize);
          return l.px !== null || l.em !== null ? resolveEmLength(l, fontSize) : pxLength(0);
        })()
      : wordSpacingDecl ? pxLength(0) : defaults.wordSpacingInherited ?? pxLength(0);

  const wordBreakDecl = findDecl(decls, 'word-break');
  const wordBreakRaw = wordBreakDecl?.value.trim();
  const wordBreak: 'normal' | 'break-all' | 'keep-all' =
    wordBreakRaw === 'break-all' || wordBreakRaw === 'keep-all' ? wordBreakRaw : 'normal';
  const overflowWrapDecl = findDeclAny(decls, ['overflow-wrap', 'word-wrap']);
  const overflowWrapRaw = overflowWrapDecl?.value.trim();
  const overflowWrap: 'normal' | 'break-word' | 'anywhere' =
    overflowWrapRaw === 'break-word' || overflowWrapRaw === 'anywhere' ? overflowWrapRaw : 'normal';

  const letterSpacingDecl = findDecl(decls, 'letter-spacing');
  const letterSpacing = letterSpacingDecl ? parseLetterSpacing(letterSpacingDecl.value) : defaults.letterSpacing ?? 0;

  let textDecorationLines = defaults.textDecorationLines ?? [];
  let textDecorationColor: Color | null = defaults.textDecorationColor ?? null;
  let textDecorationThickness: 'auto' | 'from-font' | { px: number } =
    defaults.textDecorationThickness ?? 'auto';
  const decShort = findDecl(decls, 'text-decoration');
  if (decShort) {
    const sh = parseDecorationShorthand(decShort.value);
    textDecorationLines = sh.lines.length > 0 ? sh.lines : textDecorationLines;
    if (sh.color !== null) textDecorationColor = sh.color.currentColor ? elementColor : sh.color;
    if (sh.thickness !== 'auto') textDecorationThickness = sh.thickness;
  }
  // Longhands override the shorthand (matches source-order semantics for the
  // common shorthand-then-override pattern).
  const decLineDecl = findDecl(decls, 'text-decoration-line');
  if (decLineDecl) textDecorationLines = parseDecorationLines(decLineDecl.value);
  const decColorDecl = findDecl(decls, 'text-decoration-color');
  if (decColorDecl) {
    const c = parseColorOrNull(decColorDecl.value);
    if (c) textDecorationColor = c.currentColor ? elementColor : c;
  }
  const decThicknessDecl = findDecl(decls, 'text-decoration-thickness');
  if (decThicknessDecl) textDecorationThickness = parseDecorationThickness(decThicknessDecl.value);
  const decOffsetDecl = findDecl(decls, 'text-underline-offset');
  const textUnderlineOffset = decOffsetDecl
    ? parsePxOffset(decOffsetDecl.value)
    : defaults.textUnderlineOffset ?? 0;

  const opacity = (() => {
    const d = findDecl(decls, 'opacity');
    if (!d) return 1;
    const v = d.value.trim();
    const pm = v.match(/^(\d+(?:\.\d+)?)%$/);
    const nm = v.match(/^(\d+(?:\.\d+)?)$/);
    const raw = pm ? parseFloat(pm[1]) / 100 : nm ? parseFloat(nm[1]) : NaN;
    if (Number.isNaN(raw)) return 1;
    return Math.min(1, Math.max(0, raw));
  })();

  const boxShadow = (() => {
    const d = findDecl(decls, 'box-shadow');
    if (!d) return [];
    const s = d.value.trim();
    if (s === '' || s === 'none') return [];
    return parseShadowList(s, elementColor) ?? [];
  })();
  const textShadow = (() => {
    const d = findDecl(decls, 'text-shadow');
    if (!d) return defaults.textShadow ?? [];
    const s = d.value.trim();
    if (s === '' || s === 'none') return [];
    return parseShadowList(s, elementColor) ?? defaults.textShadow ?? [];
  })();

  const decl = (name: string) => findDecl(decls, name)?.value;

  // em inside a track-size Length (calc() or fit-content()) folds against the
  // track list owner's font-size, like every other em length.
  const foldFn = (fn: TrackFunction): TrackFunction => {
    if (fn.type === 'calc') return { type: 'calc', len: resolveEmLength(fn.len, fontSize) };
    if (fn.type === 'fit-content') return { type: 'fit-content', limit: resolveEmLength(fn.limit, fontSize) };
    return fn;
  };
  const foldTrackDef = (td: TrackDef): TrackDef => ({ min: foldFn(td.min), max: foldFn(td.max), names: td.names });
  const foldTrackList = (t: GridTemplate | null): GridTemplate | null => {
    if (!t) return t;
    return { ...t, tracks: t.tracks.map(foldTrackDef) };
  };

  const gridTemplateColumns = parseTrackList(decl('grid-template-columns') ?? '');
  const gridTemplateRows = parseTrackList(decl('grid-template-rows') ?? '');
  const areasRaw = parseTemplateAreas(decl('grid-template-areas') ?? '');

  const mergeLineNames = (template: GridTemplate | null, areas: Map<string, NamedArea> | null, axis: 'row' | 'col') => {
    const lineNames = new Map<number, string[]>();
    if (template) {
      for (const [idx, names] of template.lineNames) {
        lineNames.set(idx, [...(lineNames.get(idx) ?? []), ...names]);
      }
    }
    if (areas) {
      for (const [name, a] of areas) {
        const start = axis === 'row' ? a.rowStart : a.colStart;
        const end = axis === 'row' ? a.rowEnd : a.colEnd;
        const push = (line: number, nm: string) =>
          lineNames.set(line, [...(lineNames.get(line) ?? []), nm]);
        push(start, `${name}-start`);
        push(end, `${name}-end`);
      }
    }
    return lineNames;
  };

  if (gridTemplateColumns) {
    gridTemplateColumns.lineNames = mergeLineNames(gridTemplateColumns, areasRaw.areasByName, 'col');
  }
  if (gridTemplateRows) {
    gridTemplateRows.lineNames = mergeLineNames(gridTemplateRows, areasRaw.areasByName, 'row');
  }
  const templateCols = foldTrackList(gridTemplateColumns ? { ...gridTemplateColumns, areas: areasRaw.areas, areasByName: areasRaw.areasByName } : null);
  const templateRows = foldTrackList(gridTemplateRows ? { ...gridTemplateRows, areas: areasRaw.areas, areasByName: areasRaw.areasByName } : null);

  const autoTracks = (v: string | undefined): TrackDef | null =>
    v ? parseTrackList(v)?.tracks[0] ?? null : null;

  const gridAutoColumns = autoTracks(decl('grid-auto-columns'));
  const gridAutoRows = autoTracks(decl('grid-auto-rows'));
  if (gridAutoColumns) {
    const td = foldTrackDef(gridAutoColumns);
    gridAutoColumns.min = td.min;
    gridAutoColumns.max = td.max;
  }
  if (gridAutoRows) {
    const td = foldTrackDef(gridAutoRows);
    gridAutoRows.min = td.min;
    gridAutoRows.max = td.max;
  }

  const gapDecl = decl('gap') ?? decl('grid-gap');
  const colGapDecl = decl('column-gap') ?? decl('grid-column-gap');
  const rowGapDecl = decl('row-gap') ?? decl('grid-row-gap');
  const parseGap = (v: string | undefined, first: boolean, fallback: Length): Length => {
    if (!v) return fallback;
    const parts = splitTopLevel(v.trim());
    const part = first ? parts[0] : parts[1] ?? parts[0];
    return resolveEmLength(parseLength(part), fontSize);
  };

  const gridAutoFlow = decl('grid-auto-flow')?.trim() ?? 'row';
  const autoFlowParts = gridAutoFlow.split(/\s+/);
  const gridAutoFlowColumn = autoFlowParts.includes('column');
  const gridAutoFlowDense = autoFlowParts.includes('dense');

  const lineFor = (v: string | undefined): GridLineSpec | null => (v ? parseGridLine(v) : null);

  // grid-column / grid-row / grid-area shorthands override the longhands.
  let gridRowStart = lineFor(decl('grid-row-start'));
  let gridRowEnd = lineFor(decl('grid-row-end'));
  let gridColumnStart = lineFor(decl('grid-column-start'));
  let gridColumnEnd = lineFor(decl('grid-column-end'));
  const colShort = decl('grid-column');
  const rowShort = decl('grid-row');
  const areaShort = decl('grid-area');
  if (colShort) {
    const pair = parseGridLinePair(colShort);
    gridColumnStart = pair.start;
    gridColumnEnd = pair.end;
  }
  if (rowShort) {
    const pair = parseGridLinePair(rowShort);
    gridRowStart = pair.start;
    gridRowEnd = pair.end;
  }
  if (areaShort) {
    const specs = parseGridArea(areaShort);
    gridRowStart = specs.rowStart;
    gridColumnStart = specs.colStart;
    gridRowEnd = specs.rowEnd;
    gridColumnEnd = specs.colEnd;
  }

  const flexDir = decl('flex-direction');
  const flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse' =
    flexDir === 'row-reverse'
      ? 'row-reverse'
      : flexDir === 'column'
        ? 'column'
        : flexDir === 'column-reverse'
          ? 'column-reverse'
          : 'row';
  const flexWrapDecl = decl('flex-wrap');
  const flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse' =
    flexWrapDecl === 'wrap' ? 'wrap' : flexWrapDecl === 'wrap-reverse' ? 'wrap-reverse' : 'nowrap';

  let flexGrow = 0;
  let flexShrink = 1;
  let flexBasis = parseFlexBasis(decl('flex-basis'));
  const growDecl = decl('flex-grow');
  if (growDecl && /^[\d.]+$/.test(growDecl.trim())) flexGrow = parseFloat(growDecl);
  const shrinkDecl = decl('flex-shrink');
  if (shrinkDecl && /^[\d.]+$/.test(shrinkDecl.trim())) flexShrink = parseFloat(shrinkDecl);
  const flexShort = decl('flex');
  if (flexShort) {
    const f = parseFlexShorthand(flexShort);
    flexGrow = f.grow;
    flexShrink = f.shrink;
    flexBasis = f.basis;
  }
  flexBasis = resolveEmLength(flexBasis, fontSize);

  const orderDecl = decl('order');
  const order = orderDecl && /^-?\d+$/.test(orderDecl.trim()) ? parseInt(orderDecl, 10) : 0;

  const aspectRatioDecl = findDecl(decls, 'aspect-ratio');

  const containerTypeDecl = findDecl(decls, 'container-type');
  const containerType: 'normal' | 'inline-size' | 'size' | 'block-size' = (() => {
    const v = containerTypeDecl?.value.trim();
    if (v === 'inline-size' || v === 'size' || v === 'block-size') return v;
    return 'normal';
  })();
  const containerName: string[] = (() => {
    const v = findDecl(decls, 'container-name')?.value.trim();
    if (!v || v === 'none') return [];
    return v.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  })();

  return {
    aspectRatio: (() => {
      if (!aspectRatioDecl) return ASPECT_AUTO;
      const v = aspectRatioDecl.value.trim();
      if (v === 'auto') return ASPECT_AUTO;
      const m = /^(auto\s+)?(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?$/.exec(v);
      if (!m) return ASPECT_AUTO;
      const den = m[3] !== undefined ? parseFloat(m[3]) : 1;
      if (den === 0) return ASPECT_AUTO;
      return { type: 'ratio' as const, num: parseFloat(m[2]), den, autoRatio: m[1] !== undefined };
    })(),
    wordBreak,
    overflowWrap,
    textTransform,
    textIndent,
    textIndentHanging,
    textIndentEachLine,
    wordSpacing,
    display,
    position,
    direction,
    zIndex,
    top: insetSide('top'),
    right: insetSide('right'),
    bottom: insetSide('bottom'),
    left: insetSide('left'),
    float,
    clear,
    verticalAlign,
    textAlign,
    textAlignComputed,
    borderCollapse,
    borderSpacingH: spacing.h,
    borderSpacingV: spacing.v,
    captionSide,
    tableLayout,
    emptyCells,
    boxSizing,
    overflow,
    width: len('width'),
    height: len('height'),
    minWidth: len('min-width'),
    maxWidth: len('max-width'),
    minHeight: len('min-height'),
    maxHeight: len('max-height'),
    margin: marginResolved,
    padding: paddingResolved,
    borderWidth,
    borderColor,
    borderStyle,
    borderRadius,
    backgroundColor: (() => {
      if (!bgDecl) return transparentColor;
      const c = parseColorOrNull(bgDecl.value);
      if (!c) return transparentColor;
      return c.currentColor ? elementColor : c;
    })(),
    color: elementColor,
    opacity,
    boxShadow,
    textShadow,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    listStyleType,
    listStylePosition,
    lineHeight,
    lineHeightNormal,
    whiteSpace,

    letterSpacing,
    textDecorationLines,
    textDecorationColor: textDecorationColor ?? defaults.textDecorationColor ?? null,
    textDecorationThickness,
    textUnderlineOffset,

    gridTemplateColumns: templateCols,
    gridTemplateRows: templateRows,
    gridAutoColumns,
    gridAutoRows,
    gridAutoFlowColumn,
    gridAutoFlowDense,
    rowGap: parseGap(gapDecl, true, parseLength(rowGapDecl ?? '')),
    columnGap: parseGap(gapDecl, false, parseLength(colGapDecl ?? '')),
    justifyItems: parseSelfAlign(decl('justify-items') ?? 'stretch'),
    alignItems: parseSelfAlign(decl('align-items') ?? 'stretch'),
    justifyContent: parseContentAlign(decl('justify-content') ?? 'normal'),
    alignContent: parseContentAlign(decl('align-content') ?? 'normal'),

    gridRowStart,
    gridRowEnd,
    gridColumnStart,
    gridColumnEnd,
    justifySelf: decl('justify-self') ? parseSelfAlign(decl('justify-self')!) : null,
    alignSelf: decl('align-self') ? parseSelfAlign(decl('align-self')!) : null,

    flexDirection,
    flexWrap,
    flexGrow,
    flexShrink,
    flexBasis,
    order,
    content: contentOf(decls),
    before: null,
    after: null,
    containerType,
    containerName,
    customProps,
  };
}

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * css-text-3 §2.1 case mapping with the default (locale-less) Unicode
 * mappings: uppercase/lowercase map the whole text; capitalize uppercases the
 * first grapheme of each UAX-29 word when it has an uppercase mapping (digits
 * and punctuation stay put — probe-verified: '123abc' keeps its case).
 */
export function applyTextTransform(text: string, transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'): string {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') {
    let out = '';
    for (const s of wordSegmenter.segment(text)) {
      if (s.isWordLike === true && s.segment) {
        const first = [...graphemeSegmenter.segment(s.segment)][0]?.segment ?? '';
        const rest = s.segment.slice(first.length);
        out += first.toUpperCase() + rest;
      } else {
        out += s.segment;
      }
    }
    return out;
  }
  return text;
}
