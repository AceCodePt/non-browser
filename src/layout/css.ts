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

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
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

export interface ComputedStyle {
  display: DisplayValue;
  position: 'static' | 'relative' | 'absolute' | 'fixed';
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

const NAMED_COLORS: Record<string, Color> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
};

export function parseColor(input: string): Color {
  const s = input.trim().toLowerCase();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
  }
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
  if (m) {
    return {
      r: clamp255(parseInt(m[1], 10)),
      g: clamp255(parseInt(m[2], 10)),
      b: clamp255(parseInt(m[3], 10)),
      a: m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1,
    };
  }
  const named = NAMED_COLORS[s];
  if (named) return { ...named };
  return { r: 0, g: 0, b: 0, a: 1 };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

/**
 * Parse one box-shadow / text-shadow value (css-backgrounds-3 §7.1,
 * css-text-decor-3 §7). A comma-separated list becomes a shadow per item, each
 * item's tokens are `inset? && <length>{2,4} && <color>?` with the color
 * allowed anywhere; a missing color is `currentColor` (the element's color).
 * text-shadow shares the grammar minus `inset` and the 4th (spread) length.
 */
export function parseShadowList(value: string, currentColor: Color): Shadow[] {
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
      if (/^#|^rgba?\(|^hsla?\(|^[a-zA-Z]/.test(t) && !/^-?[\d.]/.test(t)) {
        color = t.toLowerCase() === 'currentcolor' ? currentColor : parseColor(t);
        continue;
      }
      lenses.push(t);
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
  const shorthand = decls.find((d) => d.property === 'border-radius');
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
    const d = decls.find((x) => x.property === prop);
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
  const d = decls.find((x) => x.property === 'content');
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

function parseBorderStyleShorthand(raw: string): Record<Side, BorderStyleKeyword> {
  const kw = (v: string): BorderStyleKeyword =>
    v === 'inset' ? 'inset' : v === 'outset' ? 'outset' : v === 'solid' ? 'solid' : 'none';
  const parts = raw.trim().split(/\s+/).map(kw);
  const [t = 'none', r = t, b = t, l = r] = parts;
  return { top: t, right: r, bottom: b, left: l };
}

function parseBorderColorShorthand(raw: string): Record<Side, Color> {
  const parts = raw.trim().split(/\s+/).map(parseColor);
  const [t = parseColor('black'), r = t, b = t, l = r] = parts;
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

/** Split a declaration block on top-level semicolons (no strings with ';' expected). */
function splitDeclarations(block: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
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
      return {
        property: d.slice(0, idx).trim().toLowerCase(),
        value: d.slice(idx + 1).trim(),
      };
    })
    .filter((d): d is Declaration => d !== null);
}

export function parseStyleAttribute(style: string | undefined): Declaration[] {
  if (!style) return [];
  return parseDeclarationBlock(style);
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
      } else if (color === null && /^[#a-zA-Z]/.test(tok)) {
        color = parseColor(tok);
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
  borderCollapseDefault?: 'separate' | 'collapse';
  borderSpacingDefault?: number;
  borderSpacingVDefault?: number;
  tableLayoutDefault?: 'auto' | 'fixed';
  captionSideDefault?: 'top' | 'bottom';
  /** inherited `direction` (direction inherits; initial ltr). */
  directionInherited?: Direction;
}
export function makeStyle(decls: Declaration[], defaults: Defaults): ComputedStyle {
  const color = (name: string, dflt: Color): Color => {
    const v = decls.find((d) => d.property === name);
    return v ? parseColor(v.value) : dflt;
  };

  const bgDecl = decls.find((d) => d.property === 'background-color') ?? decls.find((d) => d.property === 'background');
  const elementColor = color('color', defaults.color);

  // --- font-family (needed before line-height/font-size-margin resolution) ---
  let fontFamily = defaults.fontFamily;
  const ffDecl = decls.find((d) => d.property === 'font-family');
  if (ffDecl) {
    fontFamily =
      ffDecl.value
        .split(',')
        .map((f) => f.trim().replace(/^["']|["']$/g, ''))
        .find(Boolean) ?? fontFamily;
  }

  let fontSize = defaults.fontSize;
  const fontDecl = decls.find((d) => d.property === 'font');
  if (fontDecl) {
    const m = fontDecl.value.match(
      /(?:(\d+(?:\.\d+)?)px\s*(?:\/\s*(\d+(?:\.\d+)?))?)\s*["']?([^"']+?)["']?$/,
    );
    if (m) {
      fontSize = parseFloat(m[1]);
      if (m[3]) fontFamily = m[3].trim().replace(/,$/, '').trim();
    }
  }
  const fsDecl = decls.find((d) => d.property === 'font-size');
  if (fsDecl) {
    const m = fsDecl.value.trim().match(/^(-?[\d.]+)(px|em)?$/);
    if (m) {
      if (m[2] === 'em') fontSize = defaults.fontSize * parseFloat(m[1]);
      else fontSize = parseFloat(m[1]);
    }
  }

  let lineHeight: number;
  let lineHeightNormal = false;
  const lhDecl = decls.find((d) => d.property === 'line-height');
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
    const d = decls.find((x) => x.property === 'font-weight');
    if (!d) return defaults.fontWeightDefault ?? 400;
    const v = d.value.trim();
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (v === 'bolder') return (defaults.fontWeightDefault ?? 400) <= 400 ? 700 : 900;
    if (v === 'lighter') return (defaults.fontWeightDefault ?? 400) >= 700 ? 400 : 300;
    return FONT_WEIGHT[v] ?? defaults.fontWeightDefault ?? 400;
  })();
  const fontStyle = (() => {
    const d = decls.find((x) => x.property === 'font-style');
    if (!d) return defaults.fontStyleDefault ?? 'normal';
    const v = d.value.trim();
    return v === 'italic' || v === 'oblique' ? 'italic' : 'normal';
  })();

  const listStyleType = (() => {
    const d = decls.find((x) => x.property === 'list-style-type');
    if (!d) return defaults.listStyleTypeDefault ?? 'disc';
    const v = d.value.trim().toLowerCase();
    return v === 'none' || v === 'disc' || v === 'circle' || v === 'square' || v === 'decimal' || v === 'decimal-leading-zero' ? v : 'disc';
  })();

  const listStylePosition = (() => {
    const d = decls.find((x) => x.property === 'list-style-position');
    if (!d) return defaults.listStylePositionDefault ?? 'outside';
    const v = d.value.trim().toLowerCase();
    return v === 'inside' ? 'inside' : 'outside';
  })();

  const len = (name: string, dflt: Length = AUTO): Length => {
    const d = decls.find((x) => x.property === name);
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
    const d = decls.find((x) => names.includes(x.property));
    if (!d) return dflt;
    if (d.property === 'inset') return resolveEmLength(parseBoxShorthand(d.value)[side], fontSize);
    return resolveEmLength(parseLength(d.value), fontSize);
  };

  const marginLonghand = (name: string, dflt: Length, quirkDecls: string[]): Length => {
    const d = decls.find((x) => x.property === name);
    if (d) {
      const l = parseLength(d.value);
      if (quirkDecls.includes(name) && d.quirk) l.quirk = true;
      return l;
    }
    return dflt;
  };

  const sideLens = (shorthand: string): Record<Side, Length> => {
    const sh = decls.find((d) => d.property === shorthand);
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
    const d = decls.find((x) => x.property === 'direction');
    return d && d.value.trim() === 'rtl' ? 'rtl' : (defaults.directionInherited ?? 'ltr');
  })();

  // --- margins: the logical longhands (margin-block-start/end,
  // margin-inline-start/end) feed the physical sides, and the `margin`
  // shorthand wins over everything (CSS logical/physical is resolved in source
  // order in Blink; for the UA fixtures these never coexist). The UA
  // margin-block-start carries the quirky-margin marker (Blink `__qem`).
  // The inline longhands map per `direction` (css-writing-modes-4 §2.2). ---
  const margin = (() => {
    const sh = decls.find((d) => d.property === 'margin');
    const top = marginLonghand('margin-block-start', len('margin-top', pxLength(0)), ['margin-block-start']);
    const bottom = marginLonghand('margin-block-end', len('margin-bottom', pxLength(0)), ['margin-block-end']);
    const left = marginLonghand(direction === 'rtl' ? 'margin-inline-end' : 'margin-inline-start', len('margin-left', pxLength(0)), []);
    const right = marginLonghand(direction === 'rtl' ? 'margin-inline-start' : 'margin-inline-end', len('margin-right', pxLength(0)), []);
    if (sh) return parseBoxShorthand(sh.value);
    return { top, right, bottom, left };
  })();

  // --- padding: the inline logical longhands feed the physical sides per
  // `direction` (the inline-start side holds the list gutter). ---
  const padding = (() => {
    const sh = decls.find((d) => d.property === 'padding');
    const dflt = defaults.paddingDefault ?? pxLength(0);
    const top = len('padding-top', dflt);
    const right = len(direction === 'rtl' ? 'padding-inline-start' : 'padding-inline-end', len('padding-right', dflt));
    const bottom = len('padding-bottom', dflt);
    const left = len(direction === 'rtl' ? 'padding-inline-end' : 'padding-inline-start', len('padding-left', dflt));
    if (sh) return parseBoxShorthand(sh.value);
    return { top, right, bottom, left };
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
  const borderDecl = decls.find((d) => d.property === 'border');
  const bwShort = decls.find((d) => d.property === 'border-width');
  const bsShort = decls.find((d) => d.property === 'border-style');
  const bcShort = decls.find((d) => d.property === 'border-color');
  if (borderDecl) {
    const parts = borderDecl.value.trim().split(/\s+/);
    let width = 0;
    let style: 'none' | 'solid' | 'inset' | 'outset' = 'solid';
    let col = parseColor('black');
    for (const p of parts) {
      if (p === 'solid' || p === 'none' || p === 'inset' || p === 'outset') style = p as 'none' | 'solid' | 'inset' | 'outset';
      else if (/^-?[\d.]+px$/.test(p)) width = parseFloat(p);
      else col = parseColor(p);
    }
    if (style !== 'none') {
      for (const s of SIDES) {
        borderWidth[s] = width;
        borderColor[s] = col;
        borderStyle[s] = style;
      }
    }
  } else {
    const bw = bwShort ? parseBoxShorthand(bwShort.value) : null;
    const bs = bsShort ? parseBorderStyleShorthand(bsShort.value) : null;
    const bc = bcShort ? parseBorderColorShorthand(bcShort.value) : null;
    for (const s of SIDES) {
      const w = bw ? bw[s] : len(`border-${s}-width`, pxLength(0));
      borderWidth[s] = w.px ?? 0;
      const c = bc ? bc[s] : color(`border-${s}-color`, parseColor('black'));
      borderColor[s] = c;
      borderStyle[s] = bs ? bs[s] : (() => {
        const d = decls.find((x) => x.property === `border-${s}-style`);
        const v = d ? d.value.trim() : '';
        if (v === 'inset') return 'inset';
        if (v === 'outset') return 'outset';
        if (v === 'solid') return 'solid';
        return 'none';
      })();
    }
  }

  const displayDecl = decls.find((d) => d.property === 'display');
  const display: DisplayValue = (() => {
    if (!displayDecl) return defaults.display;
    const v = displayDecl.value.trim();
    if (v === 'none') return 'none';
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

  const floatDecl = decls.find((d) => d.property === 'float');
  const positionDecl = decls.find((d) => d.property === 'position');
  const position: 'static' | 'relative' | 'absolute' | 'fixed' = (() => {
    if (!positionDecl) return 'static';
    const v = positionDecl.value.trim();
    if (v === 'relative') return 'relative';
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

  const zIndexDecl = decls.find((d) => d.property === 'z-index');
  const zIndex: number | null =
    zIndexDecl && /^-?\d+$/.test(zIndexDecl.value.trim()) ? parseInt(zIndexDecl.value.trim(), 10) : null;

  const clearDecl = decls.find((d) => d.property === 'clear');
  const clear: 'none' | 'left' | 'right' | 'both' = (() => {
    const v = clearDecl?.value.trim();
    if (v === 'left' || v === 'inline-start') return direction === 'rtl' && v === 'inline-start' ? 'right' : 'left';
    if (v === 'right' || v === 'inline-end') return direction === 'rtl' && v === 'inline-end' ? 'left' : 'right';
    if (v === 'both') return 'both';
    return 'none';
  })();

  const verticalAlignDecl = decls.find((d) => d.property === 'vertical-align');
  const verticalAlign: VerticalAlign = verticalAlignDecl
    ? (verticalAlignDecl.value.trim() as VerticalAlign)
    : (defaults.verticalAlignDefault ?? 'baseline');

  const textAlignDecl = decls.find((d) => d.property === 'text-align');
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

  const borderCollapseDecl = decls.find((d) => d.property === 'border-collapse');
  const borderCollapse: 'separate' | 'collapse' =
    borderCollapseDecl && borderCollapseDecl.value.trim() === 'collapse' ? 'collapse' : (defaults.borderCollapseDefault ?? 'separate');
  const borderSpacingDecl = decls.find((d) => d.property === 'border-spacing');
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
  const captionSideDecl = decls.find((d) => d.property === 'caption-side');
  const captionSide: 'top' | 'bottom' =
    captionSideDecl && captionSideDecl.value.trim() === 'bottom' ? 'bottom' : (defaults.captionSideDefault ?? 'top');
  const tableLayoutDecl = decls.find((d) => d.property === 'table-layout');
  const tableLayout: 'auto' | 'fixed' =
    tableLayoutDecl && tableLayoutDecl.value.trim() === 'fixed' ? 'fixed' : (defaults.tableLayoutDefault ?? 'auto');
  const emptyCellsDecl = decls.find((d) => d.property === 'empty-cells');
  const emptyCells: 'show' | 'hide' =
    emptyCellsDecl && emptyCellsDecl.value.trim() === 'hide' ? 'hide' : 'show';

  const boxSizingDecl = decls.find((d) => d.property === 'box-sizing');
  const boxSizing: 'content-box' | 'border-box' =
    boxSizingDecl && boxSizingDecl.value.trim() === 'border-box' ? 'border-box' : 'content-box';

  const overflowDecl = decls.find((d) => d.property === 'overflow');
  const overflow: OverflowValue = (() => {
    const v = overflowDecl?.value.trim() ?? '';
    if (v === 'visible' || v === 'hidden' || v === 'clip' || v === 'auto' || v === 'scroll') return v;
    // Unknown keyword or a two-axis shorthand (overflow: x y) outside the
    // single-axis model: fall back to the initial value like Chrome does for
    // an invalid value.
    return 'visible';
  })();

  const wsDecl = decls.find((d) => d.property === 'white-space');
  let whiteSpace: WhiteSpaceValue = wsDecl
    ? (wsDecl.value.trim() as WhiteSpaceValue)
    : (defaults.whiteSpaceDefault ?? 'normal');
  if (whiteSpace !== 'normal' && whiteSpace !== 'nowrap' && whiteSpace !== 'pre' && whiteSpace !== 'pre-wrap' && whiteSpace !== 'pre-line') {
    // Unknown / out-of-scope keyword: fall back to the inherited default
    // (Chrome computes unknown values to `normal` for the legacy property).
    whiteSpace = defaults.whiteSpaceDefault ?? 'normal';
  }

  const letterSpacingDecl = decls.find((d) => d.property === 'letter-spacing');
  const letterSpacing = letterSpacingDecl ? parseLetterSpacing(letterSpacingDecl.value) : defaults.letterSpacing ?? 0;

  let textDecorationLines = defaults.textDecorationLines ?? [];
  let textDecorationColor: Color | null = defaults.textDecorationColor ?? null;
  let textDecorationThickness: 'auto' | 'from-font' | { px: number } =
    defaults.textDecorationThickness ?? 'auto';
  const decShort = decls.find((d) => d.property === 'text-decoration');
  if (decShort) {
    const sh = parseDecorationShorthand(decShort.value);
    textDecorationLines = sh.lines.length > 0 ? sh.lines : textDecorationLines;
    if (sh.color !== null) textDecorationColor = sh.color;
    if (sh.thickness !== 'auto') textDecorationThickness = sh.thickness;
  }
  // Longhands override the shorthand (matches source-order semantics for the
  // common shorthand-then-override pattern).
  const decLineDecl = decls.find((d) => d.property === 'text-decoration-line');
  if (decLineDecl) textDecorationLines = parseDecorationLines(decLineDecl.value);
  const decColorDecl = decls.find((d) => d.property === 'text-decoration-color');
  if (decColorDecl) textDecorationColor = parseColor(decColorDecl.value);
  const decThicknessDecl = decls.find((d) => d.property === 'text-decoration-thickness');
  if (decThicknessDecl) textDecorationThickness = parseDecorationThickness(decThicknessDecl.value);
  const decOffsetDecl = decls.find((d) => d.property === 'text-underline-offset');
  const textUnderlineOffset = decOffsetDecl
    ? parsePxOffset(decOffsetDecl.value)
    : defaults.textUnderlineOffset ?? 0;

  const opacity = (() => {
    const d = decls.find((x) => x.property === 'opacity');
    if (!d) return 1;
    const v = d.value.trim();
    const pm = v.match(/^(\d+(?:\.\d+)?)%$/);
    const nm = v.match(/^(\d+(?:\.\d+)?)$/);
    const raw = pm ? parseFloat(pm[1]) / 100 : nm ? parseFloat(nm[1]) : NaN;
    if (Number.isNaN(raw)) return 1;
    return Math.min(1, Math.max(0, raw));
  })();

  const boxShadow = (() => {
    const d = decls.find((x) => x.property === 'box-shadow');
    if (!d) return [];
    const s = d.value.trim();
    if (s === '' || s === 'none') return [];
    return parseShadowList(s, elementColor);
  })();
  const textShadow = (() => {
    const d = decls.find((x) => x.property === 'text-shadow');
    if (!d) return defaults.textShadow ?? [];
    const s = d.value.trim();
    if (s === '' || s === 'none') return [];
    return parseShadowList(s, elementColor);
  })();

  const decl = (name: string) => decls.find((d) => d.property === name)?.value;

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

  const containerTypeDecl = decls.find((d) => d.property === 'container-type');
  const containerType: 'normal' | 'inline-size' | 'size' | 'block-size' = (() => {
    const v = containerTypeDecl?.value.trim();
    if (v === 'inline-size' || v === 'size' || v === 'block-size') return v;
    return 'normal';
  })();
  const containerName: string[] = (() => {
    const v = decls.find((d) => d.property === 'container-name')?.value.trim();
    if (!v || v === 'none') return [];
    return v.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  })();

  return {
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
    backgroundColor: bgDecl ? parseColor(bgDecl.value) : { r: 0, g: 0, b: 0, a: 0 },
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
  };
}
