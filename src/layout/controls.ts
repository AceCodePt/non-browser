/**
 * Form-control rendering (input/select/textarea/button) — the Chrome UA
 * appearance for the static renderer. Chrome paints appearance:auto controls
 * through its NativeTheme, not through the CSS border/background cascade: a
 * text field's computed style says `border: 2px inset`, but the painted frame
 * is 1px solid #767676 with the theme fill covering the rest. This module
 * carries the probed constants (frame/fill colors, checkbox/radio geometry,
 * select chevron, control sizing formulas) and the small decision surface the
 * layout and paint modules consume:
 *
 *   - `controlKindFor` classifies an element by tag + type attribute;
 *   - `controlContentHeight` / `controlBorderBoxWidth` give Chrome's default
 *     control geometry (size/cols/rows attributes, font-metric heights);
 *   - `controlLabel` returns the painted label of button-ish inputs (the
 *     `value` attribute) and the chosen option of a select;
 *   - `themePaintSpec` resolves the theme look (fill, frame, label, chevron)
 *     for an appearance:auto control, including the disabled look.
 *
 * A control whose style carries ANY author or inline declaration opts out of
 * the theme (Chrome's author-styling switches the control to CSS painting);
 * the engine models that with ComputedStyle.appearanceAuto, set in
 * resolveStyles, and an opted-out control paints through the normal
 * background/border path (docs/ledgers/form-controls.md).
 */

import type { Color } from './css.js';
import { parseColor } from './css.js';
import { fontMetricsForFamily, roundedAscent, roundedDescent, type FontVerticalMetrics } from './fontmetrics.js';
import { cssFontString, measureTextWidth } from './measure.js';
import type { P5Element } from './types.js';

export type ControlKind = 'textfield' | 'textarea' | 'button' | 'select' | 'checkbox' | 'radio';

const TEXTFIELD_TYPES = new Set(['text', 'search', 'password', 'email', 'number', 'tel', 'url']);
const BUTTON_LABELS: Record<string, string> = { submit: 'Submit', reset: 'Reset', button: '' };

const color = (rgb: string): Color => parseColor(rgb);

// Theme constants probed against headless Chrome's NativeTheme painting.
const FRAME = color('rgb(118, 118, 118)');
const FILL_DISABLED = color('rgb(248, 248, 248)');
const CHECK_BLUE = color('rgb(0, 117, 255)');
const CHECK_DISABLED_FILL = color('rgb(227, 227, 227)');
const RADIO_DOT_DISABLED = color('rgb(209, 209, 209)');
const FRAME_DISABLED = color('rgb(210, 210, 210)');
const BUTTON_FILL_DISABLED = color('rgb(238, 238, 238)');
const CHEVRON_DISABLED = color('rgba(0, 0, 0, 0.35)');

export function controlKindFor(el: P5Element): ControlKind | null {
  const tag = el.nodeName.toLowerCase();
  const type = el.attrs.find((a) => a.name === 'type')?.value.toLowerCase() ?? '';
  if (tag === 'input') {
    if (type === 'hidden') return null;
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type in BUTTON_LABELS) return 'button';
    return 'textfield';
  }
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';
  if (tag === 'button') return 'button';
  return null;
}

/** The painted label text: button-ish inputs paint their `value` (with the
 * UA defaults Submit/Reset), a select paints the chosen option's text. */
export function controlLabel(el: P5Element, kind: ControlKind): string | null {
  if (kind === 'button') {
    if (el.nodeName === 'button') return null;
    const type = el.attrs.find((a) => a.name === 'type')?.value.toLowerCase() ?? 'submit';
    return el.attrs.find((a) => a.name === 'value')?.value ?? BUTTON_LABELS[type] ?? '';
  }
  if (kind === 'select') {
    const options = optionTexts(el);
    const chosen = el.childNodes.find(
      (c) => (c as P5Element).nodeName === 'option' && (c as P5Element).attrs.some((a) => a.name === 'selected'),
    ) as P5Element | undefined;
    const text = chosen ? optionTexts(chosen)[0] : options[0];
    return text ?? '';
  }
  return null;
}

function optionTexts(el: P5Element): string[] {
  const out: string[] = [];
  for (const c of el.childNodes) {
    if ((c as P5Element).nodeName === 'option') out.push(textContent(c as P5Element));
  }
  return out;
}

function textContent(el: P5Element): string {
  let out = '';
  for (const c of el.childNodes) {
    if (c.nodeName === '#text') out += (c as { value: string }).value;
    else if (c.nodeName !== '#comment') out += textContent(c as P5Element);
  }
  return out;
}

function attrInt(el: P5Element, name: string, fallback: number): number {
  const raw = el.attrs.find((a) => a.name === name)?.value;
  const n = raw !== undefined ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/** Blink's AvgCharWidth (OS/2 xAvgCharWidth scaled) rounded to whole pixels —
 * the quantized per-character advance the `size`-derived input width uses. */
function avgCharWidth(m: FontVerticalMetrics, fontSize: number): number {
  return Math.round((m.xAvgCharWidth / m.unitsPerEm) * fontSize);
}

/**
 * Content-box height of an auto-height control (Chrome's theme metrics): the
 * single-line controls take the font's ascender+descender sum rounded up, the
 * select adds its two-pixel chrome over the rounded sum, the textarea rows
 * over the rounded sum, and checkbox/radio are fixed 13×13 boxes.
 */
export function controlContentHeight(kind: ControlKind, el: P5Element, fontSize: number, family: string): number {
  const m = fontMetricsForFamily(family);
  if (!m) return 0;
  if (kind === 'checkbox' || kind === 'radio') return 13;
  if (kind === 'textarea') {
    const rows = attrInt(el, 'rows', 2);
    return rows * (roundedAscent(m, fontSize) + roundedDescent(m, fontSize));
  }
  if (kind === 'select') return roundedAscent(m, fontSize) + roundedDescent(m, fontSize) + 2;
  return Math.ceil(((m.ascent + m.descent) / m.unitsPerEm) * fontSize);
}

/**
 * Border-box width of an auto-width control, or null when the control shrinks
 * to fit (buttons size from their label through the normal intrinsic path).
 */
export function controlBorderBoxWidth(
  kind: ControlKind,
  el: P5Element,
  fontSize: number,
  family: string,
  padBorderH: number,
): number | null {
  if (kind === 'checkbox' || kind === 'radio') return 13;
  if (kind === 'button') return null;
  const m = fontMetricsForFamily(family);
  if (!m) return null;
  if (kind === 'textfield') {
    const size = attrInt(el, 'size', 20);
    return (size + 2) * avgCharWidth(m, fontSize) + 1 + padBorderH;
  }
  if (kind === 'textarea') {
    const cols = attrInt(el, 'cols', 20);
    return Math.round(cols * measureTextWidth('0', fontSize, family)) + 16 + padBorderH;
  }
  if (kind === 'select') {
    const options = optionTexts(el);
    const widest = options.reduce((max, t) => Math.max(max, measureTextWidth(t, fontSize, family)), 0);
    return Math.ceil(widest) + 20 + padBorderH;
  }
  return null;
}

/** Whether the control's disabled attribute paints the disabled look. */
export function isDisabled(el: P5Element): boolean {
  return el.attrs.some((a) => a.name === 'disabled');
}

export interface ControlPaintSpec {
  kind: ControlKind;
  checked: boolean;
  disabled: boolean;
  fill: Color;
  frame: Color;
  /** radio only: the checked inner dot color. */
  dot?: Color;
  /** select only: the chosen option's text at its baseline. */
  label?: { text: string; x: number; baseline: number; font: string; color: Color };
  /** select only: the chevron apex (arms reach 3.5px left/right, 5px up). */
  chevron?: { x: number; y: number; color: Color };
}

/**
 * The theme look of an appearance:auto control. Fill/frame come from the
 * probed NativeTheme constants, not from the computed border/background (a
 * select computes `background-color: rgb(239, 239, 239)` but paints white;
 * a text field computes a 2px inset border but paints a 1px frame) — the
 * select's disabled fill does follow the computed color, whose alpha produces
 * Chrome's washed popup exactly.
 */
export function themePaintSpec(
  kind: ControlKind,
  el: P5Element,
  style: { color: Color; backgroundColor: Color; borderColor: { top: Color }; fontFamily: string; fontSize: number; lineHeight: number },
  contentX: number,
  contentY: number,
  contentWidth: number,
  contentHeight: number,
): ControlPaintSpec {
  const checked = el.attrs.some((a) => a.name === 'checked');
  const disabled = isDisabled(el);
  const spec: ControlPaintSpec = { kind, checked, disabled, fill: FRAME, frame: FRAME };
  switch (kind) {
    case 'textfield':
    case 'textarea':
      spec.fill = style.backgroundColor;
      spec.frame = style.borderColor.top;
      break;
    case 'button':
      // Chrome computes border-color rgb(0,0,0) on the UA button rule but the
      // NativeTheme paints the frame in the same gray as the other controls;
      // the disabled computed rgba paints the washed frame directly.
      spec.fill = disabled ? BUTTON_FILL_DISABLED : style.backgroundColor;
      spec.frame = disabled ? style.borderColor.top : FRAME;
      break;
    case 'select': {
      spec.fill = disabled ? style.backgroundColor : color('rgb(255, 255, 255)');
      spec.frame = style.borderColor.top;
      const text = controlLabel(el, kind) ?? '';
      const m = fontMetricsForFamily(style.fontFamily);
      const asc = m ? roundedAscent(m, style.fontSize) : Math.round(style.fontSize * 0.75);
      const line = m ? roundedAscent(m, style.fontSize) + roundedDescent(m, style.fontSize) : style.lineHeight;
      spec.label = {
        text,
        x: contentX + 5,
        baseline: contentY + (contentHeight - line) / 2 + asc,
        font: cssFontString(style.fontSize, style.fontFamily),
        color: style.color,
      };
      spec.chevron = {
        x: contentX + contentWidth - 7,
        y: contentY + contentHeight / 2 + 2.5,
        color: disabled ? CHEVRON_DISABLED : color('rgb(0, 0, 0)'),
      };
      break;
    }
    case 'checkbox':
      spec.fill = checked ? (disabled ? CHECK_DISABLED_FILL : CHECK_BLUE) : disabled ? FILL_DISABLED : color('rgb(255, 255, 255)');
      spec.frame = disabled ? FRAME_DISABLED : FRAME;
      break;
    case 'radio':
      spec.fill = disabled ? FILL_DISABLED : color('rgb(255, 255, 255)');
      spec.frame = disabled ? FRAME_DISABLED : checked ? CHECK_BLUE : FRAME;
      spec.dot = disabled ? RADIO_DOT_DISABLED : CHECK_BLUE;
      break;
  }
  return spec;
}
