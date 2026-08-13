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

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number; // 0..1
}

/** A length that may be a px value, a percentage, or auto. */
export interface Length {
  /** px value when not auto and not percentage. */
  px: number | null;
  /** percentage (0..100) when the value is a percentage. */
  pct: number | null;
  /** true for `auto`. */
  auto: boolean;
}

export const AUTO: Length = { px: null, pct: null, auto: true };

export function pxLength(v: number): Length {
  return { px: v, pct: null, auto: false };
}

/** Resolve a Length against a reference size (containing block content width). */
export function resolveLength(l: Length, ref: number): number | null {
  if (l.auto) return null;
  if (l.px !== null) return l.px;
  if (l.pct !== null) return (l.pct / 100) * ref;
  return null;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

export interface ComputedStyle {
  display: 'block' | 'none';
  float: 'none' | 'left' | 'right';
  clear: 'none' | 'left' | 'right' | 'both';
  boxSizing: 'content-box' | 'border-box';
  overflow: 'visible' | 'hidden';
  /** border-box width; null = auto. */
  width: Length;
  /** border-box height; null = auto. */
  height: Length;
  margin: Record<Side, Length>;
  padding: Record<Side, Length>;
  borderWidth: Record<Side, number>;
  borderColor: Record<Side, Color>;
  borderStyle: Record<Side, 'none' | 'solid'>;
  backgroundColor: Color;
  color: Color;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  whiteSpace: 'normal' | 'nowrap' | 'pre';
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

/** Parse a single length value: px, %, auto, 0. */
export function parseLength(raw: string): Length {
  const s = raw.trim();
  if (s === 'auto') return AUTO;
  const m = s.match(/^(-?[\d.]+)(px|%)?$/);
  if (m) {
    const v = parseFloat(m[1]);
    if (m[2] === '%') return { px: null, pct: v, auto: false };
    return { px: v, pct: null, auto: false };
  }
  if (s === '0') return { px: 0, pct: null, auto: false };
  return AUTO;
}

function parseBoxShorthand(raw: string): Record<Side, Length> {
  const parts = raw.trim().split(/\s+/).map(parseLength);
  const [t = AUTO, r = t, b = t, l = r] = parts;
  return { top: t, right: r, bottom: b, left: l };
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
}

export function parseStyleAttribute(style: string | undefined): Declaration[] {
  if (!style) return [];
  return splitDeclarations(style)
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

const FONT_WEIGHT: Record<string, number> = {
  normal: 400,
  bold: 700,
  bolder: 700,
  lighter: 300,
};

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

interface Defaults {
  fontFamily: string;
  fontSize: number;
  color: Color;
  lineHeight: number;
  display: 'block' | 'none';
}

export function makeStyle(decls: Declaration[], defaults: Defaults): ComputedStyle {
  const color = (name: string, dflt: Color): Color => {
    const v = decls.find((d) => d.property === name);
    return v ? parseColor(v.value) : dflt;
  };

  const bgDecl = decls.find((d) => d.property === 'background-color') ?? decls.find((d) => d.property === 'background');

  let fontFamily = defaults.fontFamily;
  let fontSize = defaults.fontSize;
  let lineHeight = defaults.lineHeight;
  const weight = (w: number): number => {
    const d = decls.find((x) => x.property === 'font-weight');
    if (!d) return w;
    const v = d.value.trim();
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    return FONT_WEIGHT[v] ?? w;
  };

  // `font` shorthand: font: [style] [weight] size[/line-height] family
  const fontDecl = decls.find((d) => d.property === 'font');
  if (fontDecl) {
    const m = fontDecl.value.match(
      /(?:(\d+(?:\.\d+)?)px\s*(?:\/\s*(\d+(?:\.\d+)?))?)\s*["']?([^"']+?)["']?$/,
    );
    if (m) {
      fontSize = parseFloat(m[1]);
      if (m[2]) lineHeight = parseFloat(m[2]);
      fontFamily = m[3].trim().replace(/,$/, '').trim();
    }
  }
  const fsDecl = decls.find((d) => d.property === 'font-size');
  if (fsDecl) {
    const m = fsDecl.value.trim().match(/^([\d.]+)px$/);
    if (m) fontSize = parseFloat(m[1]);
  }
  const fw = weight(400);
  void fw;
  const ffDecl = decls.find((d) => d.property === 'font-family');
  if (ffDecl) {
    fontFamily = ffDecl.value
      .split(',')
      .map((f) => f.trim().replace(/^["']|["']$/g, ''))
      .find(Boolean) ?? fontFamily;
  }
  const lhDecl = decls.find((d) => d.property === 'line-height');
  if (lhDecl) lineHeight = parseLineHeight(lhDecl.value, fontSize);

  const len = (name: string, dflt: Length = AUTO): Length => {
    const d = decls.find((x) => x.property === name);
    return d ? parseLength(d.value) : dflt;
  };

  const sideLens = (shorthand: string): Record<Side, Length> => {
    const sh = decls.find((d) => d.property === shorthand);
    const top = len(`${shorthand}-top`);
    const right = len(`${shorthand}-right`);
    const bottom = len(`${shorthand}-bottom`);
    const left = len(`${shorthand}-left`);
    if (sh) return parseBoxShorthand(sh.value);
    return { top, right, bottom, left };
  };

  const margin = sideLens('margin');
  const padding = sideLens('padding');

  const borderWidth: Record<Side, number> = { top: 0, right: 0, bottom: 0, left: 0 };
  const borderColor: Record<Side, Color> = { top: parseColor('black'), right: parseColor('black'), bottom: parseColor('black'), left: parseColor('black') };
  const borderStyle: Record<Side, 'none' | 'solid'> = { top: 'none', right: 'none', bottom: 'none', left: 'none' };
  const borderDecl = decls.find((d) => d.property === 'border');
  if (borderDecl) {
    const parts = borderDecl.value.trim().split(/\s+/);
    let width = 0;
    let style: 'none' | 'solid' = 'solid';
    let col = parseColor('black');
    for (const p of parts) {
      if (p === 'solid' || p === 'none') style = p === 'solid' ? 'solid' : 'none';
      else if (/^-?[\d.]+px$/.test(p)) width = parseFloat(p);
      else col = parseColor(p);
    }
    if (style === 'solid') {
      for (const s of SIDES) {
        borderWidth[s] = width;
        borderColor[s] = col;
        borderStyle[s] = 'solid';
      }
    }
  } else {
    for (const s of SIDES) {
      const w = len(`border-${s}-width`, pxLength(0));
      borderWidth[s] = w.px ?? 0;
      const c = color(`border-${s}-color`, parseColor('black'));
      borderColor[s] = c;
    }
  }

  const displayDecl = decls.find((d) => d.property === 'display');
  const display: 'block' | 'none' = displayDecl
    ? displayDecl.value.trim() === 'none'
      ? 'none'
      : displayDecl.value.trim() === 'inline'
        ? 'block'
        : 'block'
    : defaults.display;

  const floatDecl = decls.find((d) => d.property === 'float');
  const float: 'none' | 'left' | 'right' = floatDecl
    ? floatDecl.value.trim() === 'left'
      ? 'left'
      : floatDecl.value.trim() === 'right'
        ? 'right'
        : 'none'
    : 'none';

  const clearDecl = decls.find((d) => d.property === 'clear');
  const clear: 'none' | 'left' | 'right' | 'both' = clearDecl
    ? (clearDecl.value.trim() as 'none' | 'left' | 'right' | 'both')
    : 'none';

  const boxSizingDecl = decls.find((d) => d.property === 'box-sizing');
  const boxSizing: 'content-box' | 'border-box' =
    boxSizingDecl && boxSizingDecl.value.trim() === 'border-box' ? 'border-box' : 'content-box';

  const overflowDecl = decls.find((d) => d.property === 'overflow');
  const overflow: 'visible' | 'hidden' =
    overflowDecl && overflowDecl.value.trim() !== 'visible' ? 'hidden' : 'visible';

  const wsDecl = decls.find((d) => d.property === 'white-space');
  const whiteSpace: 'normal' | 'nowrap' | 'pre' = wsDecl
    ? wsDecl.value.trim() === 'pre'
      ? 'pre'
      : wsDecl.value.trim() === 'nowrap'
        ? 'nowrap'
        : 'normal'
    : 'normal';

  return {
    display,
    float,
    clear,
    boxSizing,
    overflow,
    width: len('width'),
    height: len('height'),
    margin,
    padding,
    borderWidth,
    borderColor,
    borderStyle,
    backgroundColor: bgDecl ? parseColor(bgDecl.value) : { r: 0, g: 0, b: 0, a: 0 },
    color: color('color', defaults.color),
    fontFamily,
    fontSize,
    lineHeight,
    whiteSpace,
  };
}
