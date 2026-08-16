/**
 * The UA stylesheet: built-in browser defaults for common HTML elements,
 * mirroring Chromium's `html.css` for the subset the engine renders.
 *
 * Every element's computed style is resolved as: inline `style` > author
 * stylesheet > UA stylesheet > inherited/default values. This module produces
 * the UA layer: a list of selector/declaration rules resolved per element in
 * ascending cascade order, applied before author and inline styles (so author
 * rules and inline styles always override the UA layer).
 *
 * Values match what Chrome's UA stylesheet produces for the supported
 * properties: heading font-size/margins (h1 2em, h2 1.5em, ...), p and
 * list margins, ul/ol `padding-inline-start: 40px` + disc/decimal markers,
 * nested-list margin/type changes, strong/b weight, em/i style, pre's
 * monospace face + `white-space: pre`, blockquote margins, hr's inset border,
 * and the default link color/underline.
 */

import type { P5Element } from '../layout/types.js';
import type { Declaration } from '../layout/css.js';
import { parseSelector, matchesComplex, specificity, compareSpecificity, type Specificity } from './selector.js';

export interface UaRule {
  /** selector list (each parsed with the engine's selector matcher). */
  selectors: string[];
  declarations: Declaration[];
}

/** Cartesian selector list: `outer <space> inner` for every pair. */
function descendantPairs(outer: string[], inner: string[]): string[] {
  const out: string[] = [];
  for (const o of outer) {
    for (const i of inner) out.push(`${o} ${i}`);
  }
  return out;
}

const LIST = ['dir', 'dl', 'menu', 'ol', 'ul'];
const LIST_INNER = ['dir', 'menu', 'ol', 'ul'];
const MARKER_LIST = ['dir', 'menu', 'ol', 'ul'];

/** A declaration value; `{ value, quirk }` marks the quirky UA margins
 * (Blink's `__qem` on heading/paragraph margin-block-start, which collapse
 * through their parent). */
type DeclSpec = string | { value: string; quirk?: boolean };

const decls = (d: Record<string, DeclSpec>): Declaration[] =>
  Object.entries(d).map(([property, spec]) =>
    typeof spec === 'string'
      ? { property, value: spec }
      : { property, value: spec.value, quirk: spec.quirk },
  );

/** A quirky UA margin-block-start value (Blink writes these as `X__qem`). */
const qem = (v: string): DeclSpec => ({ value: v, quirk: true });

/**
 * The UA rules in ascending-source-order (specificity ties break by source
 * order, like a stylesheet). Nested-list rules mirror Blink's `:is(dir, dl,
 * menu, ol, ul) ...` selectors, expanded to their constituent simple
 * selectors because the engine's selector matcher does not support `:is()`.
 */
export const UA_STYLES: UaRule[] = [
  { selectors: ['html'], declarations: decls({ display: 'block' }) },
  { selectors: ['body'], declarations: decls({ display: 'block', margin: '8px' }) },
  { selectors: ['div', 'article', 'aside', 'footer', 'header', 'hgroup', 'main', 'nav', 'section', 'figcaption', 'figure', 'center', 'form', 'dl', 'dt', 'dd', 'fieldset', 'legend'], declarations: decls({ display: 'block' }) },
  { selectors: ['address'], declarations: decls({ display: 'block', 'font-style': 'italic' }) },

  // --- heading elements ---
  { selectors: ['h1'], declarations: decls({ display: 'block', 'font-size': '2em', 'margin-block-start': qem('0.67em'), 'margin-block-end': '0.67em', 'font-weight': 'bold' }) },
  { selectors: ['h2'], declarations: decls({ display: 'block', 'font-size': '1.5em', 'margin-block-start': qem('0.83em'), 'margin-block-end': '0.83em', 'font-weight': 'bold' }) },
  { selectors: ['h3'], declarations: decls({ display: 'block', 'font-size': '1.17em', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'font-weight': 'bold' }) },
  { selectors: ['h4'], declarations: decls({ display: 'block', 'margin-block-start': qem('1.33em'), 'margin-block-end': '1.33em', 'font-weight': 'bold' }) },
  { selectors: ['h5'], declarations: decls({ display: 'block', 'font-size': '0.83em', 'margin-block-start': qem('1.67em'), 'margin-block-end': '1.67em', 'font-weight': 'bold' }) },
  { selectors: ['h6'], declarations: decls({ display: 'block', 'font-size': '0.67em', 'margin-block-start': qem('2.33em'), 'margin-block-end': '2.33em', 'font-weight': 'bold' }) },

  // --- paragraphs / quotes ---
  { selectors: ['p'], declarations: decls({ display: 'block', 'margin-block-start': qem('1em'), 'margin-block-end': '1em' }) },
  { selectors: ['blockquote'], declarations: decls({ display: 'block', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'margin-inline-start': '40px', 'margin-inline-end': '40px' }) },

  // --- lists ---
  { selectors: ['ul', 'menu', 'dir'], declarations: decls({ display: 'block', 'list-style-type': 'disc', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'padding-inline-start': '40px' }) },
  { selectors: ['ol'], declarations: decls({ display: 'block', 'list-style-type': 'decimal', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'padding-inline-start': '40px' }) },
  { selectors: ['li'], declarations: decls({ display: 'list-item', 'text-align': 'match-parent' }) },
  // Any list nested inside a list resets its block margins (Blink's
  // `:is(dir, dl, menu, ol, ul) :is(dir, dl, menu, ol, ul)` rule).
  { selectors: descendantPairs(LIST, LIST_INNER), declarations: decls({ 'margin-block-start': '0', 'margin-block-end': '0' }) },
  // ul/menu/dir nested inside a list become circle markers; two levels deep
  // become square.
  { selectors: descendantPairs(MARKER_LIST, ['dir', 'menu', 'ul']), declarations: decls({ 'list-style-type': 'circle' }) },
  { selectors: descendantPairs(MARKER_LIST, MARKER_LIST).flatMap((o) => descendantPairs([o], ['dir', 'menu', 'ul'])), declarations: decls({ 'list-style-type': 'square' }) },

  // --- emphasis ---
  { selectors: ['strong', 'b'], declarations: decls({ 'font-weight': 'bolder' }) },
  { selectors: ['em', 'i', 'cite', 'var', 'dfn'], declarations: decls({ 'font-style': 'italic' }) },

  // --- monospace / pre ---
  // Chrome renders `font-family: monospace` at the initial font size with the
  // fixed-pitch font's default size (13px at the default 16px root); the
  // fixture corpus uses the default root, so pre encodes that as 0.8125em.
  { selectors: ['pre'], declarations: decls({ display: 'block', 'font-family': 'monospace', 'font-size': '0.8125em', 'white-space': 'pre', 'margin-block-start': qem('1em'), 'margin-block-end': '1em' }) },
  { selectors: ['tt', 'code', 'kbd', 'samp'], declarations: decls({ 'font-family': 'monospace' }) },

  // --- horizontal rule ---
  { selectors: ['hr'], declarations: decls({ display: 'block', overflow: 'hidden', 'margin-block-start': '0.5em', 'margin-block-end': '0.5em', 'margin-inline-start': 'auto', 'margin-inline-end': 'auto', 'border-style': 'inset', 'border-width': '1px', color: 'gray' }) },

  // --- links (Chrome's -webkit-link color in light mode) ---
  { selectors: ['a'], declarations: decls({ color: 'rgb(0, 0, 238)', 'text-decoration': 'underline' }) },
];

/** Parse the UA rules once (selector matching is per-element). */
const PARSED_UA = UA_STYLES.map((rule, order) => ({
  order,
  sels: rule.selectors.map((s) => ({ raw: s, sel: parseSelector(s) })),
  decls: rule.declarations,
}));

/**
 * Resolve the UA layer for the body subtree: for every element, the
 * declarations of the matching UA rules in ascending cascade order (weakest
 * specificity/source first). `resolveStyles` feeds these below the author
 * cascade and inline styles so the UA origin has the lowest priority.
 */
export function resolveUaDecls(root: P5Element): Map<P5Element, Declaration[]> {
  const out = new Map<P5Element, Declaration[]>();
  const walk = (el: P5Element): void => {
    const matched: { spec: Specificity; order: number; decls: Declaration[] }[] = [];
    for (const rule of PARSED_UA) {
      let best: Specificity | null = null;
      for (const { sel } of rule.sels) {
        if (sel && matchesComplex(sel, el)) {
          const sp = specificity(sel);
          if (best === null || compareSpecificity(sp, best) > 0) best = sp;
        }
      }
      if (best !== null) matched.push({ spec: best, order: rule.order, decls: rule.decls });
    }
    matched.sort((a, b) => compareSpecificity(a.spec, b.spec) || a.order - b.order);
    if (matched.length > 0) {
      const all: Declaration[] = [];
      for (const m of matched) all.push(...m.decls);
      out.set(el, all);
    }
    for (const child of el.childNodes) {
      if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
      walk(child as P5Element);
    }
  };
  walk(root);
  return out;
}
