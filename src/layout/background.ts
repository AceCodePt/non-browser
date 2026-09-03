/**
 * css-images-3 gradients and css-backgrounds-3 background layers: parsing,
 * computed-value serialization (Chrome CSSOM parity), and paint geometry.
 *
 * url() raster backgrounds parse and serialize (so computed styles stay
 * truthful) but paint nothing — raster image decode is chartered-out
 * (docs/ledgers/backgrounds.md), never silently dropped from the value.
 */

import {
  parseColorOrNull,
  parseLength,
  splitOnTopLevelComma,
  splitTopLevel,
  type Color,
} from './css.js';

/**
 * One gradient-stop position with its authored unit: Chrome serializes `0` as
 * `0px` but `0%` as `0%`, so px and % stay distinct even at value 0.
 */
export type StopPosition = { pct: number } | { px: number };

export type GradientStop = { color: Color; position: StopPosition | null };

/**
 * One background-position component: the offset from the reference edge is
 * `pct/100 × (span) + px` — for background-position the span is
 * (area − image size), for radial `<position>` it is the box dimension.
 * Chrome's computed values serialize exactly this two-number form
 * (`100%`, `10px`, `calc(100% - 10px)`).
 */
export interface BgPosComponent {
  pct: number;
  px: number;
}

export interface BgPosition {
  x: BgPosComponent;
  y: BgPosComponent;
}

/** css-images-3 §3.4.1.1 direction: an authored angle or `to <side>` keywords. */
export type LinearGradientDirection =
  | { type: 'angle'; deg: number }
  | { type: 'keywords'; h: 'left' | 'right' | null; v: 'top' | 'bottom' | null };

export interface LinearGradient {
  kind: 'linear';
  repeating: boolean;
  direction: LinearGradientDirection;
  stops: GradientStop[];
}

export type RadialSizeKeyword = 'closest-corner' | 'closest-side' | 'farthest-side' | 'farthest-corner';

export type RadialSize =
  | { type: 'keyword'; keyword: RadialSizeKeyword }
  | { type: 'radii'; circle: boolean; rx: BgPosComponent; ry: BgPosComponent };

export interface RadialGradient {
  kind: 'radial';
  repeating: boolean;
  shape: 'circle' | 'ellipse';
  size: RadialSize;
  /** null = default center (50% 50%), which Chrome's computed value omits. */
  position: BgPosition | null;
  stops: GradientStop[];
}

export type BackgroundImage =
  | { kind: 'none' }
  | { kind: 'url'; url: string }
  | { kind: 'linear'; gradient: LinearGradient }
  | { kind: 'radial'; gradient: RadialGradient };

export type BgSize =
  | { type: 'keywords'; keyword: 'cover' | 'contain' }
  | { type: 'dimensions'; w: BgSizeComponent; h: BgSizeComponent };

/** background-size component: `auto`, or a px/percentage length. */
export type BgSizeComponent = { auto: true } | { auto: false; pct: number | null; px: number | null };

export type BgRepeatAxis = 'repeat' | 'no-repeat' | 'round' | 'space';

export interface BgRepeat {
  x: BgRepeatAxis;
  y: BgRepeatAxis;
}

export type BoxKeyword = 'border-box' | 'padding-box' | 'content-box';
export type BgAttachment = 'scroll' | 'fixed' | 'local';

export interface BackgroundLayer {
  image: BackgroundImage;
  position: BgPosition;
  size: BgSize;
  repeat: BgRepeat;
  clip: BoxKeyword;
  origin: BoxKeyword;
  attachment: BgAttachment;
}

const CENTER: BgPosComponent = { pct: 50, px: 0 };
const ZERO: BgPosComponent = { pct: 0, px: 0 };
const ONE_HUNDRED: BgPosComponent = { pct: 100, px: 0 };
const AUTO_SIZE: BgSizeComponent = { auto: true };
const REPEAT_XY: BgRepeat = { x: 'repeat', y: 'repeat' };
const INITIAL_LAYER: Omit<BackgroundLayer, 'image'> = {
  position: { x: ZERO, y: ZERO },
  size: { type: 'dimensions', w: AUTO_SIZE, h: AUTO_SIZE },
  repeat: REPEAT_XY,
  clip: 'border-box',
  origin: 'padding-box',
  attachment: 'scroll',
};

export function defaultLayer(image: BackgroundImage): BackgroundLayer {
  return { ...INITIAL_LAYER, image };
}

// ===== serialization (Chrome CSSOM parity) =====

function numStr(v: number): string {
  const r = Math.round(v * 1e4) / 1e4;
  return String(r);
}

export function posComponentString(c: BgPosComponent): string {
  if (c.px === 0) return `${numStr(c.pct)}%`;
  if (c.pct === 0) return `${numStr(c.px)}px`;
  return c.px < 0 ? `calc(${numStr(c.pct)}% - ${numStr(-c.px)}px)` : `calc(${numStr(c.pct)}% + ${numStr(c.px)}px)`;
}

function sizeComponentString(c: BgSizeComponent): string {
  if (c.auto) return 'auto';
  if (c.pct !== null) return `${numStr(c.pct)}%`;
  return `${numStr(c.px ?? 0)}px`;
}

export function gradientStopsString(stops: GradientStop[]): string {
  return stops
    .map((s) => {
      const color = colorString(s.color);
      if (!s.position) return color;
      return `${color} ${'pct' in s.position ? `${numStr(s.position.pct)}%` : `${numStr(s.position.px)}px`}`;
    })
    .join(', ');
}

/**
 * CSSOM color serialization: an opaque color is `rgb(r, g, b)`; a non-opaque
 * alpha serializes with the fewest decimal places that still quantizes back to
 * the same 8-bit alpha byte (Chrome prints 0x88 as 0.533). Shared with
 * computed-style.ts so gradients and plain colors print identically.
 */
export function colorString(c: Color): string {
  const byte = Math.round(Math.min(1, Math.max(0, c.a)) * 255);
  if (byte >= 255) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alphaString(byte)})`;
}

function alphaString(byte: number): string {
  for (let d = 0; d <= 6; d++) {
    const f = Math.round((byte / 255) * 10 ** d) / 10 ** d;
    if (Math.round(f * 255) === byte) {
      const s = f.toFixed(d);
      return d === 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
    }
  }
  return String(byte / 255);
}

function linearDirectionString(d: LinearGradientDirection): string {
  // The initial direction (to bottom / 180deg) drops from the computed value.
  if (d.type === 'keywords' && !d.h && d.v === 'bottom') return '';
  if (d.type === 'angle' && d.deg === 180) return '';
  if (d.type === 'angle') return `${numStr(d.deg)}deg`;
  const parts: string[] = ['to'];
  if (d.h) parts.push(d.h);
  if (d.v) parts.push(d.v);
  return parts.join(' ');
}

export function backgroundImageString(img: BackgroundImage): string {
  switch (img.kind) {
    case 'none':
      return 'none';
    case 'url':
      return `url("${img.url}")`;
    case 'linear': {
      const g = img.gradient;
      const dir = linearDirectionString(g.direction);
      return `${g.repeating ? 'repeating-' : ''}linear-gradient(${dir ? dir + ', ' : ''}${gradientStopsString(g.stops)})`;
    }
    case 'radial': {
      const g = img.gradient;
      const seg: string[] = [];
      if (g.size.type === 'radii') {
        const rx = posComponentString(g.size.rx);
        seg.push(g.size.circle ? rx : `${rx} ${posComponentString(g.size.ry)}`);
      } else {
        // farthest-corner is the initial value and drops; circle survives as
        // the shape keyword (Chrome: `circle farthest-corner at` → `circle at`).
        if (g.size.keyword !== 'farthest-corner') seg.push(g.size.keyword);
        if (g.shape === 'circle') seg.unshift('circle');
      }
      if (g.position && !(g.position.x.pct === 50 && g.position.x.px === 0 && g.position.y.pct === 50 && g.position.y.px === 0)) {
        seg.push(`at ${posComponentString(g.position.x)} ${posComponentString(g.position.y)}`);
      }
      return `${g.repeating ? 'repeating-' : ''}radial-gradient(${[seg.join(' '), gradientStopsString(g.stops)].filter(Boolean).join(', ')})`;
    }
  }
}

export function bgPositionString(p: BgPosition): string {
  return `${posComponentString(p.x)} ${posComponentString(p.y)}`;
}

export function bgSizeString(s: BgSize): string {
  if (s.type === 'keywords') return s.keyword;
  const w = sizeComponentString(s.w);
  // `auto` height drops from the computed value (`50% auto` → `50%`).
  if (s.h.auto) return w;
  return `${w} ${sizeComponentString(s.h)}`;
}

export function bgRepeatString(r: BgRepeat): string {
  if (r.x === 'repeat' && r.y === 'no-repeat') return 'repeat-x';
  if (r.x === 'no-repeat' && r.y === 'repeat') return 'repeat-y';
  if (r.x === r.y) return r.x;
  return `${r.x} ${r.y}`;
}

/**
 * The computed `background` shorthand, per layer:
 * `[<color>] <image> <repeat> <attachment> <position> / <size> <origin> <clip>`.
 * The color term rides the last layer; non-last layers only print it when
 * non-transparent (Chrome's multi-layer serialization).
 */
export function backgroundShorthandString(layers: BackgroundLayer[], color: Color): string {
  return layers
    .map((l, i) => {
      const isLast = i === layers.length - 1;
      const parts: string[] = [];
      if (isLast || color.a > 0) parts.push(colorString(color));
      parts.push(backgroundImageString(l.image));
      parts.push(bgRepeatString(l.repeat));
      parts.push(l.attachment);
      parts.push(`${bgPositionString(l.position)} / ${bgSizeString(l.size)}`);
      parts.push(l.origin);
      parts.push(l.clip);
      return parts.join(' ');
    })
    .join(', ');
}

// ===== gradient geometry =====

/**
 * The gradient-line unit vector for a W×H tile (css-images-3 §3.4.1.1): an
 * angle θ gives u = (sinθ, −cosθ); `to <corner>` gives the unit vector
 * perpendicular to the diagonal between the two corners adjacent to the
 * ending corner — d ∝ (±H, ±W), so the angle depends on the box aspect ratio
 * (a square's `to top right` is 45deg, a wide box's is shallower).
 */
export function linearUnitVector(
  grad: LinearGradient,
  w: number,
  h: number,
): { ux: number; uy: number } {
  const d = grad.direction;
  if (d.type === 'angle') {
    const a = (d.deg * Math.PI) / 180;
    return { ux: Math.sin(a), uy: -Math.cos(a) };
  }
  if (d.h && d.v) {
    const sx = d.h === 'right' ? 1 : -1;
    const sy = d.v === 'bottom' ? 1 : -1;
    const len = Math.hypot(h, w);
    return { ux: (sx * h) / len, uy: (sy * w) / len };
  }
  const a = ((d.h ? (d.h === 'right' ? 90 : 270) : d.v === 'bottom' ? 180 : 0) * Math.PI) / 180;
  return { ux: Math.sin(a), uy: -Math.cos(a) };
}

/**
 * Gradient line endpoints for a W×H tile: length |W·ux| + |H·uy| centered on
 * the box (css-images-3 §3.4.1.1).
 */
export function linearEndpoints(
  grad: LinearGradient,
  w: number,
  h: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const { ux, uy } = linearUnitVector(grad, w, h);
  const len = Math.abs(w * ux) + Math.abs(h * uy);
  const cx = w / 2;
  const cy = h / 2;
  return { x0: cx - (ux * len) / 2, y0: cy - (uy * len) / 2, x1: cx + (ux * len) / 2, y1: cy + (uy * len) / 2 };
}

export interface RadialGeometry {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function sizeComponentPx(c: BgPosComponent, ref: number): number {
  return (c.pct / 100) * ref + c.px;
}

/**
 * Ending-shape geometry for a W×H tile (css-images-3 sizing rules). Corner
 * keywords solve the ellipse-through-corner constraint in unit-square space:
 * r = √((dx/W)² + (dy/H)²), rx = W·r, ry = H·r — Blink's ComputeEndRadii.
 */
export function radialGeometry(grad: RadialGradient, w: number, h: number): RadialGeometry {
  const px = grad.position ?? { x: CENTER, y: CENTER };
  const cx = (px.x.pct / 100) * w + px.x.px;
  const cy = (px.y.pct / 100) * h + px.y.px;
  if (grad.size.type === 'radii') {
    return { cx, cy, rx: Math.max(0, sizeComponentPx(grad.size.rx, w)), ry: Math.max(0, sizeComponentPx(grad.size.ry, h)) };
  }
  const dl = cx;
  const dr = w - cx;
  const dt = cy;
  const db = h - cy;
  const corner = (dx: number, dy: number): RadialGeometry => {
    if (grad.shape === 'circle') {
      const r = Math.sqrt(dx * dx + dy * dy);
      return { cx, cy, rx: r, ry: r };
    }
    const r = Math.sqrt((dx / w) ** 2 + (dy / h) ** 2);
    return { cx, cy, rx: w * r, ry: h * r };
  };
  switch (grad.size.keyword) {
    case 'closest-side':
      return grad.shape === 'circle'
        ? { cx, cy, rx: Math.max(0, Math.min(dl, dr, dt, db)), ry: Math.max(0, Math.min(dl, dr, dt, db)) }
        : { cx, cy, rx: Math.max(0, Math.min(dl, dr)), ry: Math.max(0, Math.min(dt, db)) };
    case 'farthest-side':
      return grad.shape === 'circle'
        ? { cx, cy, rx: Math.max(dl, dr, dt, db), ry: Math.max(dl, dr, dt, db) }
        : { cx, cy, rx: Math.max(dl, dr), ry: Math.max(dt, db) };
    case 'closest-corner':
      return corner(Math.min(dl, dr), Math.min(dt, db));
    case 'farthest-corner':
      return corner(Math.max(dl, dr), Math.max(dt, db));
  }
}

// ===== color stop fixup + canvas stops =====

export interface CanvasStop {
  offset: number;
  color: Color;
}

/**
 * css-images-3 color-stop fixup, resolved against the gradient line length L
 * (linear) or the ending radius (radial): unspecified edge stops pin to 0/L,
 * unspecified middles sit midway between their neighbors, and the sequence is
 * made non-decreasing. Returns offsets along the gradient line in px.
 */
export function usedStops(stops: GradientStop[], lineLength: number): { color: Color; px: number }[] {
  const px = stops.map((s) => (s.position ? ('px' in s.position ? s.position.px : (s.position.pct / 100) * lineLength) : null));
  if (px.length === 0) return [];
  if (px[0] === null) px[0] = 0;
  if (px[px.length - 1] === null) px[px.length - 1] = lineLength;
  for (let i = 1; i < px.length - 1; i++) {
    if (px[i] === null) {
      let j = i + 1;
      while (j < px.length && px[j] === null) j++;
      const lo = px[i - 1] as number;
      const hi = j < px.length ? (px[j] as number) : lineLength;
      const step = (hi - lo) / (j - i + 1);
      for (let k = i; k < j; k++) px[k] = lo + step * (k - i + 1);
      i = j;
    }
  }
  for (let i = 1; i < px.length; i++) if ((px[i] as number) < (px[i - 1] as number)) px[i] = px[i - 1];
  return stops.map((s, i) => ({ color: s.color, px: px[i] as number }));
}

/**
 * The addColorStop list for one gradient over a line of `lengthPx` (its tile's
 * gradient line length / ending radius). Repeating gradients tile their
 * first..last span across the whole [0, lengthPx] range; Skia clamps outside
 * [0,1], which is exactly the terminal-color extrapolation Chrome paints
 * beyond the stops.
 *
 * Chrome interpolates CSS gradients in premultiplied space (css-images-3
 * §3.4); Skia's canvas gradient interpolates straight, so any segment whose
 * endpoints differ in BOTH rgb and alpha is refined with samples of the
 * premultiplied curve (piecewise-linear with 16 segments stays within a
 * byte of the hyperbolic straight-color curve).
 */
export function canvasStops(grad: LinearGradient | RadialGradient, lengthPx: number): CanvasStop[] {
  const refine = (stops: CanvasStop[]): CanvasStop[] => {
    const out: CanvasStop[] = [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      out.push(s);
      const n = stops[i + 1];
      if (!n) continue;
      const sameAlpha = Math.abs(s.color.a - n.color.a) < 1e-9;
      const sameRgb = s.color.r === n.color.r && s.color.g === n.color.g && s.color.b === n.color.b;
      if (sameAlpha || sameRgb) continue;
      // A zero-alpha endpoint's rgb is meaningless in premultiplied space —
      // the curve is fixed by the other endpoint.
      const c1 = s.color.a === 0 ? { ...n.color, a: 0 } : s.color;
      const c2 = n.color.a === 0 ? { ...s.color, a: 0 } : n.color;
      const SAMPLES = 16;
      for (let k = 1; k < SAMPLES; k++) {
        const t = k / SAMPLES;
        const a = c1.a + (c2.a - c1.a) * t;
        const offset = s.offset + (n.offset - s.offset) * t;
        if (a <= 0) {
          out.push({ offset, color: { r: 0, g: 0, b: 0, a: 0 } });
          continue;
        }
        out.push({
          offset,
          color: {
            r: Math.round(((c1.r * c1.a) * (1 - t) + (c2.r * c2.a) * t) / a),
            g: Math.round(((c1.g * c1.a) * (1 - t) + (c2.g * c2.a) * t) / a),
            b: Math.round(((c1.b * c1.a) * (1 - t) + (c2.b * c2.a) * t) / a),
            a,
          },
        });
      }
    }
    return out;
  };
  if (lengthPx <= 0) return [];
  const stops = usedStops(grad.stops, lengthPx);
  if (stops.length === 0) return [];
  if (grad.repeating) {
    const first = stops[0].px;
    const last = stops[stops.length - 1].px;
    const period = last - first;
    if (period > 0) {
      const out: CanvasStop[] = [];
      const kMin = Math.floor((0 - last) / period);
      const kMax = Math.ceil((lengthPx - first) / period);
      for (let k = kMin; k <= kMax; k++) {
        for (const s of stops) {
          const p = s.px + k * period;
          if (p < -1e-6 || p > lengthPx + 1e-6) continue;
          out.push({ offset: Math.min(1, Math.max(0, p / lengthPx)), color: s.color });
        }
      }
      return refine(out);
    }
  }
  const out: CanvasStop[] = [];
  let prev = 0;
  for (const s of stops) {
    const v = Math.min(1, Math.max(prev, s.px / lengthPx));
    out.push({ offset: v, color: s.color });
    prev = v;
  }
  return refine(out);
}

// ===== parsing =====

function componentOf(value: string): BgPosComponent | null {
  const l = parseLength(value);
  if (l.auto) return null;
  if (l.px !== null) return { pct: 0, px: l.px };
  if (l.pct !== null) return { pct: l.pct, px: 0 };
  return null;
}

function stopPositionOf(value: string): StopPosition | null {
  const l = parseLength(value);
  if (l.auto) return null;
  if (l.px !== null) return { px: l.px };
  if (l.pct !== null) return { pct: l.pct };
  return null;
}

function resolveStopColor(raw: string, elementColor: Color): Color | null {
  const c = parseColorOrNull(raw);
  return c ? (c.currentColor ? elementColor : c) : null;
}

function isBareColor(value: string): boolean {
  return parseColorOrNull(value) !== null;
}

function isDirectionToken(value: string): boolean {
  const s = value.trim().toLowerCase();
  return /^to(\s|$)/.test(s) || /^-?[\d.]+(deg|grad|rad|turn)$/.test(s);
}

function parseLinearDirection(value: string): LinearGradientDirection | null {
  const s = value.trim().toLowerCase();
  const m = s.match(/^(-?[\d.]+)deg$/);
  if (m) {
    const v = Number.parseFloat(m[1]);
    return Number.isNaN(v) ? null : { type: 'angle', deg: v };
  }
  const to = s.match(/^to\s+(.+)$/);
  if (!to) return null;
  let h: 'left' | 'right' | null = null;
  let v: 'top' | 'bottom' | null = null;
  for (const side of to[1].split(/\s+/)) {
    if (side === 'left' || side === 'right') {
      if (h) return null;
      h = side;
    } else if (side === 'top' || side === 'bottom') {
      if (v) return null;
      v = side;
    } else return null;
  }
  if (!h && !v) return null;
  return { type: 'keywords', h, v };
}

function parseGradientStops(args: string[], elementColor: Color): GradientStop[] | null {
  const out: GradientStop[] = [];
  for (const arg of args) {
    const tokens = splitTopLevel(arg);
    if (tokens.length === 0) return null;
    let color: Color | null = null;
    const positions: StopPosition[] = [];
    for (const t of tokens) {
      const parsed = parseColorOrNull(t);
      if (parsed) {
        if (color) return null;
        color = resolveStopColor(t, elementColor);
        continue;
      }
      const p = stopPositionOf(t);
      if (!p) return null;
      positions.push(p);
    }
    if (!color || positions.length > 2) return null;
    if (positions.length <= 1) {
      out.push({ color, position: positions[0] ?? null });
    } else {
      // double position expands to two stops (Chrome's computed value does too)
      out.push({ color, position: positions[0] });
      out.push({ color, position: positions[1] });
    }  }
  if (out.length < 2) return null;
  return out;
}

/** Parse one `<image>`: none / url() / (repeating-)linear/radial-gradient. */
export function parseBackgroundImageOne(value: string, elementColor: Color): BackgroundImage | null {
  const s = value.trim();
  if (s === '' || s.toLowerCase() === 'none') return { kind: 'none' };
  const urlMatch = s.match(/^url\((.*)\)$/i);
  if (urlMatch) {
    const inner = urlMatch[1].trim();
    const q = inner.match(/^(['"])(.*)\1$/s);
    return { kind: 'url', url: q ? q[2] : inner };
  }
  const lin = s.match(/^(repeating-)?linear-gradient\((.*)\)$/i);
  if (lin) {
    const args = splitOnTopLevelComma(lin[2]);
    let direction: LinearGradientDirection = { type: 'angle', deg: 180 };
    let stopArgs = args;
    const first = args[0]?.trim() ?? '';
    if (first !== '' && !isBareColor(first) && isDirectionToken(first)) {
      const d = parseLinearDirection(first);
      if (!d) return null;
      direction = d;
      stopArgs = args.slice(1);
    } else if (first !== '' && !isBareColor(first)) {
      return null;
    }
    const stops = parseGradientStops(stopArgs, elementColor);
    if (!stops) return null;
    return { kind: 'linear', gradient: { kind: 'linear', repeating: lin[1] !== undefined, direction, stops } };
  }
  const rad = s.match(/^(repeating-)?radial-gradient\((.*)\)$/i);
  if (rad) return parseRadialGradient(rad[2], rad[1] !== undefined, elementColor);
  return null;
}

const RADIAL_SIZE_KEYWORDS: RadialSizeKeyword[] = ['closest-corner', 'closest-side', 'farthest-side', 'farthest-corner'];

function parseRadialGradient(argsRaw: string, repeating: boolean, elementColor: Color): BackgroundImage | null {
  const args = splitOnTopLevelComma(argsRaw);
  let shape: 'circle' | 'ellipse' = 'ellipse';
  let size: RadialSize = { type: 'keyword', keyword: 'farthest-corner' };
  let position: BgPosition | null = null;
  let stopArgs = args;
  const first = args[0]?.trim() ?? '';
  if (first !== '' && !isBareColor(first)) {
    const tokens = splitTopLevel(first);
    const atIdx = tokens.findIndex((t) => t.toLowerCase() === 'at');
    const pre = atIdx === -1 ? tokens : tokens.slice(0, atIdx);
    const post = atIdx === -1 ? [] : tokens.slice(atIdx + 1);
    if (pre.length === 0 && post.length === 0) return null;
    let i = 0;
    if (pre[i]?.toLowerCase() === 'circle' || pre[i]?.toLowerCase() === 'ellipse') {
      shape = pre[i].toLowerCase() as 'circle' | 'ellipse';
      i++;
    }
    if (i < pre.length) {
      const kw = pre[i].toLowerCase();
      if (RADIAL_SIZE_KEYWORDS.includes(kw as RadialSizeKeyword)) {
        size = { type: 'keyword', keyword: kw as RadialSizeKeyword };
        i++;
      } else {
        const rx = componentOf(pre[i]);
        const ry = i + 1 < pre.length ? componentOf(pre[i + 1]) : null;
        if (!rx || (pre.length - i === 2 && !ry)) return null;
        // one explicit radius = a circle of that radius (css-images-3 §3.2.1)
        size = ry
          ? { type: 'radii', circle: false, rx, ry }
          : { type: 'radii', circle: true, rx, ry: rx };
        shape = 'ellipse';
        i += ry ? 2 : 1;
      }
    }
    if (i < pre.length) return null;
    if (post.length > 0) {
      const p = parseBgPosition(post.join(' '));
      if (!p) return null;
      position = p;
    }
    stopArgs = args.slice(1);
  }
  if (shape === 'circle' && size.type === 'radii' && !size.circle) return null;
  const stops = parseGradientStops(stopArgs, elementColor);
  if (!stops) return null;
  return { kind: 'radial', gradient: { kind: 'radial', repeating, shape, size, position, stops } };
}

/**
 * background-position (css-backgrounds-3 §5.5): 1–4 keywords/lengths with
 * offset-from-edge syntax, normalized to the left/top-origin two-number form
 * Chrome reports (`right 10px top 20px` → `calc(100% - 10px) 20px`).
 */
export function parseBgPosition(value: string): BgPosition | null {
  const tokens = splitTopLevel(value);
  if (tokens.length === 0 || tokens.length > 4) return null;
  const isEdge = (t: string): t is 'left' | 'right' | 'top' | 'bottom' =>
    ['left', 'right', 'top', 'bottom'].includes(t);
  let x: BgPosComponent = CENTER;
  let y: BgPosComponent = CENTER;
  let xSet = false;
  let ySet = false;
  let i = 0;
  // One axis: `<edge> [<offset>]` | `center` | `<length>`. A left/top edge is
  // the zero origin, so `left 20%` folds to `20%`; a right/bottom edge folds
  // the offset out of 100% (`right 10px` → calc(100% - 10px)).
  const axis = (tokens: string[], pos: number, horizontal: boolean): { value: BgPosComponent; next: number } | null => {
    if (pos >= tokens.length) return { value: CENTER, next: pos };
    const t = tokens[pos];
    const lower = t.toLowerCase();
    const edgeOk = isEdge(lower) && (horizontal ? lower === 'left' || lower === 'right' : lower === 'top' || lower === 'bottom');
    const edge = horizontal ? (lower === 'left' ? ZERO : ONE_HUNDRED) : lower === 'top' ? ZERO : ONE_HUNDRED;
    if (edgeOk) {
      const next = tokens[pos + 1];
      if (next && !isEdge(next.toLowerCase()) && next.toLowerCase() !== 'center') {
        const off = componentOf(next);
        if (!off) return null;
        const value =
          edge.pct === 0 && edge.px === 0
            ? off
            : { pct: edge.pct - off.pct, px: edge.px - off.px };
        return { value, next: pos + 2 };
      }
      return { value: edge, next: pos + 1 };
    }
    if (lower === 'center') return { value: CENTER, next: pos + 1 };
    const c = componentOf(t);
    if (!c) return null;
    return { value: c, next: pos + 1 };
  };
  const xa = axis(tokens, 0, true);
  if (!xa) return null;
  x = xa.value;
  i = xa.next;
  xSet = i > 0;
  const ya = axis(tokens, i, false);
  if (!ya) return null;
  y = ya.value;
  i = ya.next;
  ySet = i > xa.next;
  if (i < tokens.length || (!xSet && !ySet)) return null;
  return { x, y };
}

function parseBgSizeComponent(t: string): BgSizeComponent | null {
  if (t.toLowerCase() === 'auto') return AUTO_SIZE;
  const l = parseLength(t);
  if (l.auto) return null;
  if (l.px !== null) return { auto: false, pct: null, px: l.px };
  if (l.pct !== null) return { auto: false, pct: l.pct, px: null };
  return null;
}

export function parseBgSize(value: string): BgSize | null {
  const s = value.trim().toLowerCase();
  if (s === 'cover' || s === 'contain') return { type: 'keywords', keyword: s };
  const tokens = splitTopLevel(s);
  if (tokens.length === 0 || tokens.length > 2) return null;
  const w = parseBgSizeComponent(tokens[0]);
  if (!w) return null;
  const h = tokens.length === 2 ? parseBgSizeComponent(tokens[1]) : AUTO_SIZE;
  if (!h) return null;
  return { type: 'dimensions', w, h };
}

export function parseBgRepeat(value: string): BgRepeat | null {
  const s = value.trim().toLowerCase();
  if (s === 'repeat-x') return { x: 'repeat', y: 'no-repeat' };
  if (s === 'repeat-y') return { x: 'no-repeat', y: 'repeat' };
  const axis = (t: string): BgRepeatAxis | null =>
    t === 'repeat' || t === 'no-repeat' || t === 'round' || t === 'space' ? (t as BgRepeatAxis) : null;
  const tokens = splitTopLevel(s);
  if (tokens.length === 0 || tokens.length > 2) return null;
  const x = axis(tokens[0]);
  if (!x) return null;
  const y = tokens.length === 2 ? axis(tokens[1]) : x;
  if (!y) return null;
  return { x, y };
}

export function parseBoxKeyword(value: string): BoxKeyword | null {
  const s = value.trim().toLowerCase();
  return s === 'border-box' || s === 'padding-box' || s === 'content-box' ? s : null;
}

const BOX_KEYWORDS = ['border-box', 'padding-box', 'content-box'];
const REPEAT_KEYWORDS = ['repeat', 'no-repeat', 'round', 'space', 'repeat-x', 'repeat-y'];
const ATTACHMENT_KEYWORDS = ['scroll', 'fixed', 'local'];

/**
 * The `background` shorthand (css-backgrounds-3 §9): layers split on
 * top-level commas; the last layer may carry a color; each layer takes image,
 * position [/size], repeat, attachment, and up to two box keywords (first
 * sets origin and clip, second overrides clip). Returns null on any parse
 * failure (the declaration drops, like Chrome's parse-error recovery).
 */
export function parseBackgroundShorthand(
  value: string,
  elementColor: Color,
): { layers: BackgroundLayer[]; color: Color | null } | null {
  const parts = splitOnTopLevelComma(value);
  if (parts.length === 0) return null;
  const layers: BackgroundLayer[] = [];
  let color: Color | null = null;
  for (let li = 0; li < parts.length; li++) {
    const tokens = splitTopLevel(parts[li]);
    const layer: BackgroundLayer = { ...INITIAL_LAYER, image: { kind: 'none' } };
    let image: BackgroundImage | null = null;
    let sawImage = false;
    let sawOrigin = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const lower = t.toLowerCase();
      if (t.includes('(')) {
        if (sawImage) return null;
        image = parseBackgroundImageOne(t, elementColor);
        if (!image) return null;
        sawImage = true;
        continue;
      }
      if (lower === 'none') {
        if (sawImage) return null;
        image = { kind: 'none' };
        sawImage = true;
        continue;
      }
      if (lower === '/') return null;
      if (REPEAT_KEYWORDS.includes(lower)) {
        const r = parseBgRepeat(
          lower === 'repeat-x' || lower === 'repeat-y' || i + 1 >= tokens.length || !REPEAT_KEYWORDS.includes(tokens[i + 1].toLowerCase())
            ? lower
            : `${lower} ${tokens[i + 1].toLowerCase()}`,
        );
        if (!r) return null;
        if (lower !== 'repeat-x' && lower !== 'repeat-y' && r.x !== r.y) i++;
        layer.repeat = r;
        continue;
      }
      if (ATTACHMENT_KEYWORDS.includes(lower)) {
        layer.attachment = lower as BgAttachment;
        continue;
      }
      if (BOX_KEYWORDS.includes(lower)) {
        if (sawOrigin) {
          layer.clip = lower as BoxKeyword;
        } else {
          layer.origin = lower as BoxKeyword;
          layer.clip = lower as BoxKeyword;
          sawOrigin = true;
        }
        continue;
      }
      const isLastLayer = li === parts.length - 1;
      if (isLastLayer && parseColorOrNull(t)) {
        if (color) return null;
        color = resolveStopColor(t, elementColor);
        continue;
      }
      // position [/ size]: gather tokens until a structural keyword
      const group: string[] = [t];
      let j = i + 1;
      while (j < tokens.length) {
        const nt = tokens[j];
        const nl = nt.toLowerCase();
        if (nt.includes('(') || BOX_KEYWORDS.includes(nl) || REPEAT_KEYWORDS.includes(nl) || ATTACHMENT_KEYWORDS.includes(nl)) break;
        group.push(nt);
        j++;
      }
      const slashIdx = group.findIndex((g) => g === '/');
      let sizeTokens: string[] = [];
      if (slashIdx !== -1) {
        sizeTokens = group.slice(slashIdx + 1);
        group.length = slashIdx;
        if (sizeTokens.length === 0) return null;
      }
      if (group.length === 0) return null;
      const pos = parseBgPosition(group.join(' '));
      if (!pos) return null;
      layer.position = pos;
      if (sizeTokens.length > 0) {
        const size = parseBgSize(sizeTokens.join(' '));
        if (!size) return null;
        layer.size = size;
      }
      i = j - 1;
    }
    layer.image = image ?? { kind: 'none' };
    layers.push(layer);
  }
  return { layers, color };
}
