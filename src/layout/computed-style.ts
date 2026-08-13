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

import type { Color, ComputedStyle, Length } from './css.js';

export type ComputedStyleProps = Record<string, string>;

function colorString(c: Color): string {
  if (c.a >= 1) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function lengthString(l: Length, ref: number): string | null {
  if (l.auto) return 'auto';
  if (l.px !== null) return `${l.px}px`;
  if (l.pct !== null) return `${l.pct}%`;
  return null;
}

/** Serialize a family name the way CSSOM does: quote names that need it. */
function fontFamilyString(family: string): string {
  if (/^[-_a-zA-Z][-_a-zA-Z0-9]*$/.test(family)) return family;
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Compute one property's CSSOM string for a style. Returns null when the
 * property is not computed by the engine (so it cannot be compared).
 */
export function computedStyleString(style: ComputedStyle, prop: string, refWidth: number): string | null {
  switch (prop) {
    case 'display': {
      const d = style.display;
      return d === 'inline-grid' ? 'grid' : d;
    }
    case 'font-size':
      return `${style.fontSize}px`;
    case 'font-family':
      return fontFamilyString(style.fontFamily);
    case 'line-height':
      return `${style.lineHeight}px`;
    case 'color':
      return colorString(style.color);
    case 'background-color':
      return colorString(style.backgroundColor);
    case 'width':
      return lengthString(style.width, refWidth);
    case 'height':
      return lengthString(style.height, refWidth);
    case 'margin-top':
      return lengthString(style.margin.top, refWidth);
    case 'margin-right':
      return lengthString(style.margin.right, refWidth);
    case 'margin-bottom':
      return lengthString(style.margin.bottom, refWidth);
    case 'margin-left':
      return lengthString(style.margin.left, refWidth);
    case 'padding-top':
      return lengthString(style.padding.top, refWidth);
    case 'padding-right':
      return lengthString(style.padding.right, refWidth);
    case 'padding-bottom':
      return lengthString(style.padding.bottom, refWidth);
    case 'padding-left':
      return lengthString(style.padding.left, refWidth);
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
    case 'letter-spacing':
      return `${style.letterSpacing}px`;
    case 'text-decoration-line':
      return style.textDecorationLines.length === 0 ? 'none' : style.textDecorationLines.join(' ');
    default:
      return null;
  }
}

/**
 * Compute a CSSOM property map for a style across a list of properties.
 * Properties the engine cannot compute are omitted from the result.
 */
export function computedStyleFor(style: ComputedStyle, props: string[], refWidth: number): ComputedStyleProps {
  const out: ComputedStyleProps = {};
  for (const p of props) {
    const v = computedStyleString(style, p, refWidth);
    if (v !== null) out[p] = v;
  }
  return out;
}
