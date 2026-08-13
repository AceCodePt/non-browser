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

// ===== Grid track sizing =====

/** A single track sizing function, after minmax() is decomposed. */
export type TrackFunction =
  | { type: 'fixed'; px: number }
  | { type: 'pct'; pct: number }
  | { type: 'flex'; flex: number }
  | { type: 'auto' }
  | { type: 'min-content' }
  | { type: 'max-content' }
  | { type: 'fit-content'; limit: { px: number | null; pct: number | null } };

/** One resolved track: a min and a max sizing function plus start line names. */
export interface TrackDef {
  min: TrackFunction;
  max: TrackFunction;
  /** line names attached to the track's start line (explicit grid line index). */
  names: string[];
}

export interface NamedArea {
  rowStart: number;
  colStart: number;
  rowEnd: number;
  colEnd: number;
}

export interface GridTemplate {
  /** explicit track definitions (repeat() expanded), or [] for none. */
  tracks: TrackDef[];
  /** row-major area name matrix; '.' marks a null cell. */
  areas: string[][] | null;
  /** named grid areas -> 1-based line rectangle. */
  areasByName: Map<string, NamedArea>;
  /** explicit line index (1-based) -> line names. */
  lineNames: Map<number, string[]>;
}

/** A grid-line value as authored (pre-resolution). */
export type GridLineSpec =
  | { kind: 'auto' }
  | { kind: 'integer'; value: number; name?: string }
  | { kind: 'span'; count: number; name?: string }
  | { kind: 'name'; value: string };

export type SelfAlign = 'stretch' | 'start' | 'end' | 'center';
export type ContentAlign =
  | 'normal'
  | 'stretch'
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';

export interface ComputedStyle {
  display: 'block' | 'none' | 'grid' | 'inline-grid';
  float: 'none' | 'left' | 'right';
  clear: 'none' | 'left' | 'right' | 'both';
  boxSizing: 'content-box' | 'border-box';
  overflow: 'visible' | 'hidden';
  /** border-box width; null = auto. */
  width: Length;
  /** border-box height; null = auto. */
  height: Length;
  minWidth: Length;
  maxWidth: Length;
  minHeight: Length;
  maxHeight: Length;
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

  // --- grid container properties ---
  gridTemplateColumns: GridTemplate | null;
  gridTemplateRows: GridTemplate | null;
  gridAutoColumns: TrackDef | null;
  gridAutoRows: TrackDef | null;
  /** true when grid-auto-flow: column. */
  gridAutoFlowColumn: boolean;
  /** true when grid-auto-flow: dense. */
  gridAutoFlowDense: boolean;
  rowGap: Length;
  columnGap: Length;
  justifyItems: SelfAlign;
  alignItems: SelfAlign;
  justifyContent: ContentAlign;
  alignContent: ContentAlign;

  // --- grid item properties ---
  gridRowStart: GridLineSpec | null;
  gridRowEnd: GridLineSpec | null;
  gridColumnStart: GridLineSpec | null;
  gridColumnEnd: GridLineSpec | null;
  justifySelf: SelfAlign | null;
  alignSelf: SelfAlign | null;
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

// ===== Grid parsing helpers =====

/** Split a value on top-level whitespace, honoring () nesting. */
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

function parseFixedOrPct(raw: string): { px: number | null; pct: number | null } | null {
  const s = raw.trim();
  if (/^-?[\d.]+px$/.test(s)) return { px: parseFloat(s), pct: null };
  if (/^-?[\d.]+%$/.test(s)) return { px: null, pct: parseFloat(s) };
  return null;
}

/** Parse a single sizing function token (fr/px/%/auto/min-content/max-content/fit-content). */
function parseTrackFunction(raw: string): TrackFunction {
  const s = raw.trim();
  if (s.startsWith('fit-content(') && s.endsWith(')')) {
    const limit = parseFixedOrPct(s.slice('fit-content('.length, -1));
    return { type: 'fit-content', limit: limit ?? { px: null, pct: null } };
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

/** Parse one track-list token into a TrackDef (handles minmax()/bare values). */
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

/** Parse grid-template-areas string list into a name matrix + areas. */
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
  // Validate rectangularity of each area.
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

/** Parse grid-row/grid-column shorthand. */
function parseGridLinePair(value: string): { start: GridLineSpec; end: GridLineSpec } {
  const parts = value.split('/').map((p) => p.trim());
  if (parts.length === 1) {
    const first = parseGridLine(parts[0]);
    const end = first.kind === 'name' ? first : { kind: 'auto' as const };
    return { start: first, end };
  }
  return { start: parseGridLine(parts[0]), end: parseGridLine(parts[1]) };
}

/** Parse grid-area shorthand: row-start / column-start / row-end / column-end. */
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

function parseSelfAlign(value: string): SelfAlign {
  const s = value.trim();
  if (s === 'start' || s === 'flex-start' || s === 'self-start') return 'start';
  if (s === 'end' || s === 'flex-end' || s === 'self-end') return 'end';
  if (s === 'center') return 'center';
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
    const top = len(`${shorthand}-top`, pxLength(0));
    const right = len(`${shorthand}-right`, pxLength(0));
    const bottom = len(`${shorthand}-bottom`, pxLength(0));
    const left = len(`${shorthand}-left`, pxLength(0));
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
  const display: 'block' | 'none' | 'grid' | 'inline-grid' = (() => {
    if (!displayDecl) return defaults.display;
    const v = displayDecl.value.trim();
    if (v === 'none') return 'none';
    if (v === 'grid') return 'grid';
    if (v === 'inline-grid') return 'grid';
    if (v === 'inline' || v === 'inline-block' || v === 'flex' || v === 'inline-flex') return 'block';
    return 'block';
  })();

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

  // --- grid properties ---
  const decl = (name: string) => decls.find((d) => d.property === name)?.value;

  const gridTemplateColumns = parseTrackList(decl('grid-template-columns') ?? '');
  const gridTemplateRows = parseTrackList(decl('grid-template-rows') ?? '');
  const areasRaw = parseTemplateAreas(decl('grid-template-areas') ?? '');

  // Merge line names from template tracks and implicit area lines.
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
  const templateCols = gridTemplateColumns ? { ...gridTemplateColumns, areas: areasRaw.areas, areasByName: areasRaw.areasByName } : null;
  const templateRows = gridTemplateRows ? { ...gridTemplateRows, areas: areasRaw.areas, areasByName: areasRaw.areasByName } : null;

  const autoTracks = (v: string | undefined): TrackDef | null =>
    v ? parseTrackList(v)?.tracks[0] ?? null : null;

  const gapDecl = decl('gap') ?? decl('grid-gap');
  const colGapDecl = decl('column-gap') ?? decl('grid-column-gap');
  const rowGapDecl = decl('row-gap') ?? decl('grid-row-gap');
  const parseGap = (v: string | undefined, first: boolean, fallback: Length): Length => {
    if (!v) return fallback;
    const parts = v.trim().split(/\s+/);
    const part = first ? parts[0] : parts[1] ?? parts[0];
    return parseLength(part);
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

  return {
    display,
    float,
    clear,
    boxSizing,
    overflow,
    width: len('width'),
    height: len('height'),
    minWidth: len('min-width'),
    maxWidth: len('max-width'),
    minHeight: len('min-height'),
    maxHeight: len('max-height'),
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

    gridTemplateColumns: templateCols,
    gridTemplateRows: templateRows,
    gridAutoColumns: autoTracks(decl('grid-auto-columns')),
    gridAutoRows: autoTracks(decl('grid-auto-rows')),
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
  };
}
