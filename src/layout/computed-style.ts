/**
 * Format the engine's ComputedStyle as CSSOM computed-value strings, matching
 * Chrome's `getComputedStyle().getPropertyValue(...)` output for the subset of
 * properties the spine engine resolves. This is the layer-2 (style resolution)
 * contract: exact string equality against the Chrome oracle.
 *
 * Only properties the engine computes are supported; anything else returns
 * null and the harness treats it as "not compared". Fixtures must therefore
 * list properties that are deterministic in both engines (explicit px values,
 * explicit keywords — not `auto` where Chrome reports the used value).
 */

import type { Color, ComputedStyle, CornerRadii, Length, Viewport } from './css.js';

export type ComputedStyleProps = Record<string, string>;

function colorString(c: Color): string {
  if (c.a >= 1) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

/**
 * Serialize a resolved length the way CSSOM does. Viewport units resolve to px
 * against the viewport input at computed-value time (matching Chrome's
 * `getComputedStyle().getPropertyValue(...)`).
 */
function lengthString(l: Length, ref: number, viewport?: Viewport | null): string | null {
  if (l.auto) return 'auto';
  if (l.px !== null) return `${l.px}px`;
  if (l.pct !== null) return `${l.pct}%`;
  if (viewport) {
    const vw = viewport.width / 100;
    const vh = viewport.height / 100;
    if (l.vw !== null) return `${l.vw * vw}px`;
    if (l.vh !== null) return `${l.vh * vh}px`;
    if (l.vmin !== null) return `${l.vmin * Math.min(vw, vh)}px`;
    if (l.vmax !== null) return `${l.vmax * Math.max(vw, vh)}px`;
  }
  return null;
}

/** Serialize a family name the way CSSOM does: quote names that need it. */
function fontFamilyString(family: string): string {
  if (/^[-_a-zA-Z][-_a-zA-Z0-9]*$/.test(family)) return family;
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Shortest repeating-form serialization of one radius axis, matching Chrome:
 * all-equal → 1 value, TL=BR & TR=BL → 2, TR=BL → 3, else 4.
 */
function radiusAxisString(corners: CornerRadii[], get: (c: CornerRadii) => Length, refWidth: number, viewport?: Viewport | null): string {
  const s = corners.map((c) => lengthString(get(c), refWidth, viewport) ?? '0px');
  if (s.every((v) => v === s[0])) return s[0];
  if (s[0] === s[2] && s[1] === s[3]) return `${s[0]} ${s[1]}`;
  if (s[1] === s[3]) return `${s[0]} ${s[1]} ${s[2]}`;
  return s.join(' ');
}

/** Serialize the `border-radius` shorthand (horizontal axis [/ vertical axis]). */
function borderRadiusString(style: ComputedStyle, refWidth: number, viewport?: Viewport | null): string {
  const { topLeft, topRight, bottomRight, bottomLeft } = style.borderRadius;
  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  const h = radiusAxisString(corners, (c) => c.rx, refWidth, viewport);
  const v = radiusAxisString(corners, (c) => c.ry, refWidth, viewport);
  return h === v ? h : `${h} / ${v}`;
}

/** Serialize one corner longhand: `rx` when rx===ry, else `rx ry`. */
function cornerRadiusString(c: CornerRadii, refWidth: number, viewport?: Viewport | null): string {
  const rx = lengthString(c.rx, refWidth, viewport) ?? '0px';
  const ry = lengthString(c.ry, refWidth, viewport) ?? '0px';
  return rx === ry ? rx : `${rx} ${ry}`;
}

/**
 * Compute one property's CSSOM string for a style. Returns null when the
 * property is not computed by the engine (so it cannot be compared).
 */
export function computedStyleString(style: ComputedStyle, prop: string, refWidth: number, viewport?: Viewport | null): string | null {
  switch (prop) {
    case 'display': {
      const d = style.display;
      return d === 'inline-grid' ? 'grid' : d;
    }
    case 'font-weight':
      return String(style.fontWeight);
    case 'font-style':
      return style.fontStyle;
    case 'list-style-type':
      return style.listStyleType;
    case 'position':
      return style.position;
    case 'z-index':
      return style.zIndex === null ? 'auto' : String(style.zIndex);
    case 'top':
      return lengthString(style.top, refWidth, viewport);
    case 'right':
      return lengthString(style.right, refWidth, viewport);
    case 'bottom':
      return lengthString(style.bottom, refWidth, viewport);
    case 'left':
      return lengthString(style.left, refWidth, viewport);
    case 'text-align':
      return style.textAlignComputed;
    case 'border-collapse':
      return style.borderCollapse;
    case 'border-spacing':
      return style.borderSpacingH === style.borderSpacingV
        ? `${style.borderSpacingH}px`
        : `${style.borderSpacingH}px ${style.borderSpacingV}px`;
    case 'caption-side':
      return style.captionSide;
    case 'table-layout':
      return style.tableLayout;
    case 'empty-cells':
      return style.emptyCells;
    case 'font-size':
      return `${style.fontSize}px`;
    case 'font-family':
      return fontFamilyString(style.fontFamily);
    case 'line-height':
      return style.lineHeightNormal ? 'normal' : `${style.lineHeight}px`;
    case 'color':
      return colorString(style.color);
    case 'background-color':
      return colorString(style.backgroundColor);
    case 'width':
      return lengthString(style.width, refWidth, viewport);
    case 'height':
      return lengthString(style.height, refWidth, viewport);
    case 'margin-top':
      return lengthString(style.margin.top, refWidth, viewport);
    case 'margin-right':
      return lengthString(style.margin.right, refWidth, viewport);
    case 'margin-bottom':
      return lengthString(style.margin.bottom, refWidth, viewport);
    case 'margin-left':
      return lengthString(style.margin.left, refWidth, viewport);
    case 'padding-top':
      return lengthString(style.padding.top, refWidth, viewport);
    case 'padding-right':
      return lengthString(style.padding.right, refWidth, viewport);
    case 'padding-bottom':
      return lengthString(style.padding.bottom, refWidth, viewport);
    case 'padding-left':
      return lengthString(style.padding.left, refWidth, viewport);
    case 'border-top-width':
      return `${style.borderWidth.top}px`;
    case 'border-right-width':
      return `${style.borderWidth.right}px`;
    case 'border-bottom-width':
      return `${style.borderWidth.bottom}px`;
    case 'border-left-width':
      return `${style.borderWidth.left}px`;
    case 'border-top-style':
      return style.borderStyle.top;
    case 'border-right-style':
      return style.borderStyle.right;
    case 'border-bottom-style':
      return style.borderStyle.bottom;
    case 'border-left-style':
      return style.borderStyle.left;
    case 'border-color': {
      const { top, right, bottom, left } = style.borderColor;
      const s = (c: Color) => colorString(c);
      if (s(top) === s(right) && s(top) === s(bottom) && s(top) === s(left)) return s(top);
      if (s(top) === s(bottom) && s(right) === s(left)) return `${s(top)} ${s(right)}`;
      if (s(right) === s(left)) return `${s(top)} ${s(right)} ${s(bottom)}`;
      return `${s(top)} ${s(right)} ${s(bottom)} ${s(left)}`;
    }
    case 'border-radius':
      return borderRadiusString(style, refWidth, viewport);
    case 'border-top-left-radius':
      return cornerRadiusString(style.borderRadius.topLeft, refWidth, viewport);
    case 'border-top-right-radius':
      return cornerRadiusString(style.borderRadius.topRight, refWidth, viewport);
    case 'border-bottom-right-radius':
      return cornerRadiusString(style.borderRadius.bottomRight, refWidth, viewport);
    case 'border-bottom-left-radius':
      return cornerRadiusString(style.borderRadius.bottomLeft, refWidth, viewport);
    case 'box-sizing':
      return style.boxSizing;
    case 'overflow':
      return style.overflow;
    case 'white-space':
      return style.whiteSpace;
    case 'float':
      return style.float;
    case 'clear':
      return style.clear;
    case 'vertical-align':
      return style.verticalAlign;
    case 'letter-spacing':
      // Chrome serializes the initial `normal` keyword as 'normal', and an
      // explicit `0px` as '0px'. The engine collapses both to 0; fixtures that
      // compare letter-spacing therefore only author non-zero values or the
      // initial value, and 0 serializes as 'normal' here.
      return style.letterSpacing === 0 ? 'normal' : `${style.letterSpacing}px`;
    case 'text-decoration-line':
      return style.textDecorationLines.length === 0 ? 'none' : style.textDecorationLines.join(' ');
    case 'content': {
      // Chrome serializes none/normal as 'none' on pseudo-elements and string
      // content as a double-quoted CSS string (escapes backslashes and quotes).
      if (style.content.kind !== 'text') return 'none';
      const escaped = style.content.text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    default:
      return null;
  }
}

/**
 * Compute a CSSOM property map for a style across a list of properties.
 * Properties the engine cannot compute are omitted from the result.
 */
export function computedStyleFor(style: ComputedStyle, props: string[], refWidth: number, viewport?: Viewport | null): ComputedStyleProps {
  const out: ComputedStyleProps = {};
  for (const p of props) {
    const v = computedStyleString(style, p, refWidth, viewport);
    if (v !== null) out[p] = v;
  }
  return out;
}
