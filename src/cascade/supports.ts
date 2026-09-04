/**
 * css-conditional-3 §4 @supports conditions: parsing and evaluation.
 *
 * Declaration conditions evaluate against the engine's real property/value
 * surface — the validators reuse the same css.ts/calc.ts parsers makeStyle
 * runs, so a condition the engine cannot truthfully honor evaluates false
 * (the point of a feature query: unsupported blocks drop like Chrome's).
 * Unknown property names, malformed declarations, and general-enclosed
 * conditions (`(selector(...))`, `(font-tech(...))`) are false; the corpus
 * documents that exclusion. Per css-conditional-3 §4.1 precedence is
 * or → and → not with parenthesized grouping.
 */

import { parseColorOrNull, parseLength, parseShadowList, parseTemplateAreas, parseTrackList, splitTopLevel } from '../layout/css.js';
import { parseMathValue } from '../layout/calc.js';
import { splitTopLevel as splitTopLevelTokens, tokenize, type Token } from './media.js';

export type SupportsCondition =
  | { type: 'decl'; property: string; value: string }
  | { type: 'general-enclosed' }
  | { type: 'not'; child: SupportsCondition }
  | { type: 'and'; children: SupportsCondition[] }
  | { type: 'or'; children: SupportsCondition[] };

/** css-conditional-3 §4.1: or binds loosest, then and, then unary not. */
export function parseSupportsCondition(prelude: string): SupportsCondition | null {
  return parseSupportsOr(tokenize(prelude));
}

function parseSupportsOr(tokens: Token[]): SupportsCondition | null {
  if (tokens.length === 0) return null;
  const parts = splitTopLevelTokens(tokens, 'or');
  if (parts.length > 1) {
    const children: SupportsCondition[] = [];
    for (const p of parts) {
      const c = parseSupportsAnd(p);
      if (!c) return null;
      children.push(c);
    }
    return { type: 'or', children };
  }
  return parseSupportsAnd(tokens);
}

function parseSupportsAnd(tokens: Token[]): SupportsCondition | null {
  const parts = splitTopLevelTokens(tokens, 'and');
  if (parts.length > 1) {
    const children: SupportsCondition[] = [];
    for (const p of parts) {
      const c = parseSupportsOperand(p);
      if (!c) return null;
      children.push(c);
    }
    return { type: 'and', children };
  }
  return parseSupportsOperand(parts[0] ?? []);
}

function parseSupportsOperand(tokens: Token[]): SupportsCondition | null {
  if (tokens.length >= 1 && tokens[0] === 'not') {
    const child = parseSupportsOperand(tokens.slice(1));
    return child ? { type: 'not', child } : null;
  }
  if (tokens.length >= 2 && tokens[0] === '(' && tokens[tokens.length - 1] === ')') {
    const inner = tokens.slice(1, -1);
    if (inner[0] === 'not' || hasTopLevelLogical(inner)) {
      return parseSupportsOr(inner);
    }
    const colon = inner.indexOf(':');
    if (colon > 0) {
      const property = inner.slice(0, colon).join('').trim().toLowerCase();
      // tokenize drops whitespace, so the join is canonical except around
      // parens — `calc ( 1px + 2px )` must read `calc(1px + 2px)`.
      const value = inner
        .slice(colon + 1)
        .join(' ')
        .replace(/\s*\(\s*/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
      if (property === '' || value === '') return { type: 'general-enclosed' };
      return { type: 'decl', property, value };
    }
    return { type: 'general-enclosed' };
  }
  return null;
}

function hasTopLevelLogical(tokens: Token[]): boolean {
  return splitTopLevelTokens(tokens, 'and').length > 1 || splitTopLevelTokens(tokens, 'or').length > 1;
}

// --- declaration evaluation against the engine's real surface ---

type Validator = (value: string) => boolean;

/** Units parseLength genuinely resolves; a dimension it would silently coerce
 * to auto is not "supported" (truthful-answer rule). */
function isLength(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (s === 'auto') return true;
  if (/^(calc|min|max|clamp)\(/.test(s)) {
    const expr = parseMathValue(s);
    return expr !== null && !expr.pure;
  }
  return /^-?[\d.]+(px|em|rem|%|vw|vh|vmin|vmax)$/.test(s);
}

const isNumber = (v: string): boolean => /^-?[\d.]+$/.test(v.trim());
const isInteger = (v: string): boolean => /^-?\d+$/.test(v.trim());
const keywordSet = (...words: string[]) => (v: string): boolean => words.includes(v.trim().toLowerCase());

const BLACK: { r: number; g: number; b: number; a: number } = { r: 0, g: 0, b: 0, a: 1 };

const lengthList = (v: string): boolean => splitTopLevel(v).every(isLength);

/** 1-4 length parts, the box-shorthand grammar margin/padding/inset take. */
const boxLengths = (v: string): boolean => {
  const parts = splitTopLevel(v);
  return parts.length >= 1 && parts.length <= 4 && parts.every(isLength);
};

const FONT_SIZE_KEYWORDS = ['xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large', 'smaller', 'larger'];
const FONT_WEIGHTS = ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const BORDER_STYLES = ['none', 'hidden', 'solid', 'dotted', 'dashed', 'double', 'inset', 'outset', 'groove', 'ridge'];

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

function eachSideProps(prefix: string, suffix: string): string[] {
  return SIDES.map((s) => `${prefix}${s}${suffix}`);
}

interface PropGroup {
  props: string[];
  validate: Validator;
}

/**
 * One group per value grammar, each validator reusing the parser makeStyle
 * will run for that property. Properties makeStyle does not consume are
 * absent — a query over them evaluates false. Shorthands validate like the
 * component value makeStyle actually consumes (e.g. `background` is honored
 * only as a color today, so `background: url(...)` is false here even though
 * Chrome says true — the images surface is a pending slice).
 */
const PROP_GROUPS: PropGroup[] = [
  {
    props: ['color', 'background-color', 'border-color', ...eachSideProps('border-', '-color'), 'text-decoration-color'],
    validate: (v) => parseColorOrNull(v) !== null,
  },
  {
    props: ['background'],
    validate: (v) => v.trim().toLowerCase() === 'none' || parseColorOrNull(v) !== null,
  },
  {
    props: ['border'],
    validate: (v) => {
      const parts = splitTopLevel(v);
      return (
        parts.length >= 1 &&
        parts.length <= 3 &&
        parts.every((p) => isLength(p) || BORDER_STYLES.includes(p.toLowerCase()) || parseColorOrNull(p) !== null)
      );
    },
  },
  {
    props: ['border-width', ...eachSideProps('border-', '-width')],
    validate: (v) => {
      const s = v.trim().toLowerCase();
      return isLength(v) || ['thin', 'medium', 'thick'].includes(s);
    },
  },
  {
    props: ['border-style', ...eachSideProps('border-', '-style')],
    validate: (v) => splitTopLevel(v).every((p) => BORDER_STYLES.includes(p.toLowerCase())),
  },
  {
    props: ['border-radius'],
    validate: (v) => {
      const halves = v.split('/');
      return halves.length <= 2 && halves.every((h) => lengthList(h));
    },
  },
  {
    props: [
      'width', 'height', 'top', 'right', 'bottom', 'left', 'inset',
      'inset-block-start', 'inset-block-end', 'inset-inline-start', 'inset-inline-end',
      ...eachSideProps('margin-', ''), 'margin-block-start', 'margin-block-end', 'margin-inline-start', 'margin-inline-end',
      ...eachSideProps('padding-', ''), 'padding-block-start', 'padding-block-end', 'padding-inline-start', 'padding-inline-end',
      'letter-spacing', 'text-underline-offset', 'text-decoration-thickness',
      'gap', 'grid-gap', 'column-gap', 'row-gap', 'grid-column-gap', 'grid-row-gap',
      'grid-auto-columns', 'grid-auto-rows', 'flex-basis', 'border-spacing',
    ],
    validate: isLength,
  },
  {
    props: ['margin', 'padding', 'inset'],
    validate: boxLengths,
  },
  { props: ['opacity', 'flex-grow', 'flex-shrink'], validate: isNumber },
  { props: ['z-index'], validate: (v) => isInteger(v) || v.trim().toLowerCase() === 'auto' },
  { props: ['order'], validate: isInteger },
  {
    props: ['font-size'],
    validate: (v) => isLength(v) || FONT_SIZE_KEYWORDS.includes(v.trim().toLowerCase()),
  },
  { props: ['line-height'], validate: (v) => isNumber(v) || v.trim().toLowerCase() === 'normal' || isLength(v) },
  { props: ['font-weight'], validate: keywordSet(...FONT_WEIGHTS) },
  { props: ['font-style'], validate: keywordSet('normal', 'italic', 'oblique') },
  { props: ['font-family'], validate: (v) => v.trim().length > 0 && !/[;{}]/.test(v) },
  {
    props: ['font'],
    validate: (v) => {
      const first = splitTopLevel(v)[0] ?? '';
      return isLength(first) || FONT_SIZE_KEYWORDS.includes(first.toLowerCase()) || FONT_WEIGHTS.includes(first.toLowerCase());
    },
  },
  {
    props: ['display'],
    validate: keywordSet(
      'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid',
      'list-item', 'none', 'table', 'inline-table', 'table-row', 'table-cell',
      'table-row-group', 'table-header-group', 'table-footer-group',
      'table-column', 'table-column-group', 'table-caption',
    ),
  },
  { props: ['position'], validate: keywordSet('static', 'relative', 'absolute', 'fixed') },
  { props: ['float', 'clear'], validate: keywordSet('none', 'left', 'right', 'both') },
  { props: ['box-sizing'], validate: keywordSet('content-box', 'border-box') },
  { props: ['overflow'], validate: keywordSet('visible', 'hidden', 'clip', 'auto', 'scroll') },
  { props: ['white-space'], validate: keywordSet('normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line') },
  { props: ['text-align'], validate: keywordSet('left', 'center', 'right', 'justify', 'start', 'end') },
  { props: ['vertical-align'], validate: keywordSet('baseline', 'sub', 'super', 'top', 'middle', 'bottom') },
  { props: ['direction'], validate: keywordSet('ltr', 'rtl') },
  {
    props: ['list-style-type'],
    validate: keywordSet('disc', 'circle', 'square', 'decimal', 'none', 'lower-roman', 'upper-roman', 'lower-alpha', 'upper-alpha'),
  },
  { props: ['list-style-position'], validate: keywordSet('inside', 'outside') },
  {
    props: ['list-style'],
    validate: (v) => {
      const parts = splitTopLevel(v);
      return parts.length >= 1 && parts.length <= 3;
    },
  },
  {
    props: ['flex-direction'],
    validate: keywordSet('row', 'row-reverse', 'column', 'column-reverse'),
  },
  { props: ['flex-wrap'], validate: keywordSet('nowrap', 'wrap', 'wrap-reverse') },
  {
    props: ['flex'],
    validate: (v) => {
      const parts = splitTopLevel(v);
      return parts.length >= 1 && parts.length <= 3 && parts.some((p) => isNumber(p) || p.toLowerCase() === 'auto');
    },
  },
  {
    props: ['align-items', 'align-self'],
    validate: keywordSet('stretch', 'start', 'end', 'center', 'baseline'),
  },
  {
    props: ['justify-content', 'align-content', 'justify-items', 'justify-self'],
    validate: keywordSet('stretch', 'start', 'end', 'center', 'space-between', 'space-around', 'space-evenly'),
  },
  {
    props: ['grid-template-columns', 'grid-template-rows', 'grid-auto-columns', 'grid-auto-rows'],
    validate: (v) => parseTrackList(v) !== null,
  },
  { props: ['grid-template-areas'], validate: (v) => parseTemplateAreas(v).areas !== null },
  {
    props: ['grid-auto-flow'],
    validate: (v) => {
      const parts = v.trim().toLowerCase().split(/\s+/);
      return parts.length <= 2 && parts.every((p) => ['row', 'column', 'dense'].includes(p));
    },
  },
  {
    props: ['grid-row', 'grid-column', 'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end', 'grid-area'],
    validate: (v) => v.trim().length > 0 && !/[;{}]/.test(v),
  },
  { props: ['border-collapse'], validate: keywordSet('collapse', 'separate') },
  { props: ['caption-side'], validate: keywordSet('top', 'bottom') },
  { props: ['table-layout'], validate: keywordSet('auto', 'fixed') },
  { props: ['empty-cells'], validate: keywordSet('show', 'hide') },
  {
    props: ['text-decoration', 'text-decoration-line'],
    validate: (v) => splitTopLevel(v).every((p) => ['none', 'underline', 'overline', 'line-through'].includes(p.toLowerCase())),
  },
  { props: ['box-shadow', 'text-shadow'], validate: (v) => parseShadowList(v, BLACK) !== null },
  {
    props: ['outline-width'],
    validate: (v) => isLength(v) || ['thin', 'medium', 'thick'].includes(v.trim().toLowerCase()),
  },
  {
    props: ['outline-style'],
    validate: (v) =>
      ['dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset', 'auto', 'none', 'hidden'].includes(v.trim().toLowerCase()),
  },
  {
    props: ['outline-color'],
    validate: (v) => ['auto', 'invert'].includes(v.trim().toLowerCase()) || parseColorOrNull(v) !== null,
  },
  {
    props: ['outline'],
    validate: (v) => {
      const parts = splitTopLevel(v);
      if (parts.length < 1 || parts.length > 3) return false;
      let width = false;
      let style = false;
      let color = false;
      for (const p of parts) {
        const lower = p.toLowerCase();
        // `hidden` is not in the shorthand's <outline-line-style> grammar.
        if (lower === 'hidden') return false;
        if (!style && ['dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset', 'auto', 'none'].includes(lower)) {
          style = true;
          continue;
        }
        if (!width && (isLength(p) || ['thin', 'medium', 'thick'].includes(lower))) {
          width = true;
          continue;
        }
        if (!color && (lower === 'auto' || lower === 'invert' || parseColorOrNull(p) !== null)) {
          color = true;
          continue;
        }
        return false;
      }
      return true;
    },
  },
  { props: ['content'], validate: (v) => v.trim().toLowerCase() === 'none' || /^(['"]).*\1$/.test(v.trim()) },
  { props: ['container-type'], validate: keywordSet('normal', 'inline-size') },
  { props: ['container-name'], validate: (v) => v.trim().length > 0 },
];

const PROP_VALIDATORS = new Map<string, Validator>();
for (const g of PROP_GROUPS) {
  for (const p of g.props) PROP_VALIDATORS.set(p, g.validate);
}

/** css-variables-1: a custom-property declaration condition is true when the
 * value is a non-empty token stream (any value is valid for a custom name). */
function isCustomPropertyDecl(property: string, value: string): boolean {
  return property.startsWith('--') && value.length > 0;
}

export function evaluateSupportsDeclaration(property: string, value: string): boolean {
  if (isCustomPropertyDecl(property, value)) return true;
  const validate = PROP_VALIDATORS.get(property);
  if (!validate) return false;
  return validate(value);
}

export function evaluateSupportsCondition(cond: SupportsCondition): boolean {
  switch (cond.type) {
    case 'decl':
      return evaluateSupportsDeclaration(cond.property, cond.value);
    case 'general-enclosed':
      return false;
    case 'not':
      return !evaluateSupportsCondition(cond.child);
    case 'and':
      return cond.children.every(evaluateSupportsCondition);
    case 'or':
      return cond.children.some(evaluateSupportsCondition);
  }
}
