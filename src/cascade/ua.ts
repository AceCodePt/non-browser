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
 * the default link color/underline, and the form-control defaults
 * (input/select/textarea/button) including the statically matched
 * :disabled state colors.
 */

import type { P5Element } from '../layout/types.js';
import type { Declaration } from '../layout/css.js';
import { parseSelector, matchesComplex, specificity, compareSpecificity, type Specificity } from './selector.js';

export interface UaRule {
  selectors: string[];
  declarations: Declaration[];
}

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
 * order, like a stylesheet). Nested-list rules mirror Blink's `:is(dl, ol,
 * ul) ...` selectors directly — the engine's matcher supports :is(). Legacy
 * elements (center, tt, dir, menu, font, marquee, big, blink, strike,
 * plaintext, xmp, nobr) get no UA rules by design — they render as generic
 * boxes per the modern-compat program (docs/ledgers/legacy-removal.md).
 */
export const UA_STYLES: UaRule[] = [
  { selectors: ['html'], declarations: decls({ display: 'block' }) },
  { selectors: ['body'], declarations: decls({ display: 'block', margin: '8px' }) },
  { selectors: ['div', 'article', 'aside', 'footer', 'header', 'hgroup', 'main', 'nav', 'section', 'figcaption', 'figure', 'form', 'dl', 'dt', 'dd', 'fieldset', 'legend'], declarations: decls({ display: 'block' }) },
  { selectors: ['address'], declarations: decls({ display: 'block', 'font-style': 'italic' }) },

  { selectors: ['h1'], declarations: decls({ display: 'block', 'font-size': '2em', 'margin-block-start': qem('0.67em'), 'margin-block-end': '0.67em', 'font-weight': 'bold' }) },
  { selectors: ['h2'], declarations: decls({ display: 'block', 'font-size': '1.5em', 'margin-block-start': qem('0.83em'), 'margin-block-end': '0.83em', 'font-weight': 'bold' }) },
  { selectors: ['h3'], declarations: decls({ display: 'block', 'font-size': '1.17em', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'font-weight': 'bold' }) },
  { selectors: ['h4'], declarations: decls({ display: 'block', 'margin-block-start': qem('1.33em'), 'margin-block-end': '1.33em', 'font-weight': 'bold' }) },
  { selectors: ['h5'], declarations: decls({ display: 'block', 'font-size': '0.83em', 'margin-block-start': qem('1.67em'), 'margin-block-end': '1.67em', 'font-weight': 'bold' }) },
  { selectors: ['h6'], declarations: decls({ display: 'block', 'font-size': '0.67em', 'margin-block-start': qem('2.33em'), 'margin-block-end': '2.33em', 'font-weight': 'bold' }) },

  { selectors: ['p'], declarations: decls({ display: 'block', 'margin-block-start': qem('1em'), 'margin-block-end': '1em' }) },
  { selectors: ['blockquote'], declarations: decls({ display: 'block', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'margin-inline-start': '40px', 'margin-inline-end': '40px' }) },

  { selectors: ['ul'], declarations: decls({ display: 'block', 'list-style-type': 'disc', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'padding-inline-start': '40px' }) },
  { selectors: ['ol'], declarations: decls({ display: 'block', 'list-style-type': 'decimal', 'margin-block-start': qem('1em'), 'margin-block-end': '1em', 'padding-inline-start': '40px' }) },
  { selectors: ['li'], declarations: decls({ display: 'list-item', 'text-align': 'match-parent' }) },
  // Any list nested inside a list resets its block margins (Blink's
  // `:is(dl, ol, ul) :is(ol, ul)` rule).
  { selectors: [':is(dl, ol, ul) :is(ol, ul)'], declarations: decls({ 'margin-block-start': '0', 'margin-block-end': '0' }) },
  // ul nested inside a list becomes circle markers; two levels deep becomes
  // square.
  { selectors: [':is(ol, ul) ul'], declarations: decls({ 'list-style-type': 'circle' }) },
  { selectors: [':is(ol, ul) :is(ol, ul) ul'], declarations: decls({ 'list-style-type': 'square' }) },

  { selectors: ['strong', 'b'], declarations: decls({ 'font-weight': 'bolder' }) },
  { selectors: ['em', 'i', 'cite', 'var', 'dfn'], declarations: decls({ 'font-style': 'italic' }) },

  // Chrome renders `font-family: monospace` at the initial font size with the
  // fixed-pitch font's default size (13px at the default 16px root); the
  // fixture corpus uses the default root, so pre encodes that as 0.8125em.
  { selectors: ['pre'], declarations: decls({ display: 'block', 'font-family': 'monospace', 'font-size': '0.8125em', 'white-space': 'pre', 'margin-block-start': qem('1em'), 'margin-block-end': '1em' }) },
  { selectors: ['code', 'kbd', 'samp'], declarations: decls({ 'font-family': 'monospace' }) },

  // Bidi rendering (the WHATWG HTML rendering spec's bidi block, mirrored from
  // Blink html.css): every block container and [dir] element isolates its
  // contents, bdo overrides+isolates, and dir=auto pre/textarea compute
  // plaintext. The engine computes and reports these values (getComputedStyle
  // parity with Chrome) but does not run the Unicode BiDi Algorithm; the
  // reordering boundary is declared in docs/ledgers/unicode-bidi.md.
  { selectors: ['address', 'blockquote', 'center', 'div', 'figure', 'figcaption', 'footer', 'form', 'header', 'hr', 'legend', 'listing', 'main', 'p', 'plaintext', 'pre', 'summary', 'xmp', 'article', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup', 'nav', 'section', 'search', 'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'dir', 'dd', 'dl', 'dt', 'menu', 'ol', 'ul', 'li', 'bdi', 'output', '[dir=ltr i]', '[dir=rtl i]', '[dir=auto i]'], declarations: decls({ 'unicode-bidi': 'isolate' }) },
  { selectors: ['bdo', 'bdo[dir]'], declarations: decls({ 'unicode-bidi': 'isolate-override' }) },
  { selectors: ['textarea[dir=auto i]', 'pre[dir=auto i]'], declarations: decls({ 'unicode-bidi': 'plaintext' }) },

  { selectors: ['hr'], declarations: decls({ display: 'block', overflow: 'hidden', 'margin-block-start': '0.5em', 'margin-block-end': '0.5em', 'margin-inline-start': 'auto', 'margin-inline-end': 'auto', 'border-style': 'inset', 'border-width': '1px', color: 'gray' }) },

  { selectors: ['a'], declarations: decls({ color: 'rgb(0, 0, 238)', 'text-decoration': 'underline' }) },

  // Modern text-level elements (Blink html.css): mark's system-color look,
  // del/s strike-through, ins/u underline, small/sub/sup's relative font-size,
  // and sub/sup's shifted baseline.
  { selectors: ['mark'], declarations: decls({ 'background-color': 'rgb(255, 255, 0)', color: 'rgb(0, 0, 0)' }) },
  { selectors: ['del', 's'], declarations: decls({ 'text-decoration': 'line-through' }) },
  { selectors: ['ins'], declarations: decls({ 'text-decoration': 'underline' }) },
  { selectors: ['small'], declarations: decls({ 'font-size': 'smaller' }) },
  { selectors: ['sub'], declarations: decls({ 'vertical-align': 'sub', 'font-size': 'smaller' }) },
  { selectors: ['sup'], declarations: decls({ 'vertical-align': 'super', 'font-size': 'smaller' }) },

  // fieldset/legend (Blink html.css): the 2px groove border resolves to
  // ThreeDFace (rgb(239,239,239) on this headless-Linux chrome), and the
  // legend's placement over the top border is the fieldset layout in
  // block-inline.ts (legend participates without table layout). The
  // `min-inline-size: min-content` Blink also applies is out of scope — the
  // corpus fieldset always stretches wider than its legend.
  { selectors: ['fieldset'], declarations: decls({ 'margin-inline-start': '2px', 'margin-inline-end': '2px', border: '2px groove rgb(239, 239, 239)', 'padding-block-start': '0.35em', 'padding-block-end': '0.625em', 'padding-inline-start': '0.75em', 'padding-inline-end': '0.75em' }) },
  { selectors: ['legend'], declarations: decls({ 'padding-inline-start': '2px', 'padding-inline-end': '2px' }) },

  // details/summary (Blink html.css): details is a block container and the
  // first-of-type summary becomes a list-item with a disclosure marker. The
  // marker triangle is a declared divergence (see docs/ledgers/text-level-ua.md);
  // the engine computes the list-item display and the marker's inline advance so
  // summary text lands where Chrome's sits, but paints no triangle.
  { selectors: ['details'], declarations: decls({ display: 'block' }) },
  { selectors: ['summary'], declarations: decls({ display: 'block' }) },
  { selectors: ['details > summary:first-of-type'], declarations: decls({ display: 'list-item', 'list-style-type': 'disclosure-closed', 'list-style-position': 'inside' }) },
  { selectors: ['details[open] > summary:first-of-type'], declarations: decls({ 'list-style-type': 'disclosure-open' }) },

  // Form controls (Chrome UA defaults for appearance:auto, probed against
  // headless Chrome; see docs/ledgers/form-controls.md): all inline-block
  // border-box with the control font, hidden inputs display:none, and the
  // per-control chrome (borders, padding, background). The painted look comes
  // from the theme (layout/controls.ts), not these border values — Chrome
  // computes a 2px inset border on text fields but paints a 1px frame.
  { selectors: ['input', 'select', 'textarea', 'button'], declarations: decls({ display: 'inline-block', 'box-sizing': 'border-box', 'font-family': 'Arial', 'font-size': '13.3333px', 'line-height': 'normal', color: 'rgb(0, 0, 0)' }) },
  { selectors: ['input[type=hidden]'], declarations: decls({ display: 'none' }) },
  { selectors: ['input[type=text]', 'input[type=search]', 'input[type=password]', 'input[type=email]', 'input[type=number]', 'input[type=tel]', 'input[type=url]', 'input:not([type])'], declarations: decls({ 'border-width': '2px', 'border-style': 'inset', 'border-color': 'rgb(118, 118, 118)', padding: '1px 2px', 'background-color': 'rgb(255, 255, 255)', overflow: 'clip' }) },
  { selectors: ['input[type=checkbox]'], declarations: decls({ 'margin-top': '3px', 'margin-right': '3px', 'margin-bottom': '3px', 'margin-left': '4px' }) },
  { selectors: ['input[type=radio]'], declarations: decls({ 'margin-top': '3px', 'margin-right': '3px', 'margin-bottom': '0px', 'margin-left': '5px' }) },
  { selectors: ['button', 'input[type=button]', 'input[type=submit]', 'input[type=reset]'], declarations: decls({ 'border-width': '2px', 'border-style': 'outset', 'border-color': 'rgb(0, 0, 0)', padding: '1px 6px', 'background-color': 'rgb(239, 239, 239)', 'text-align': 'center' }) },
  { selectors: ['input[type=button]', 'input[type=submit]', 'input[type=reset]'], declarations: decls({ 'white-space': 'pre' }) },
  { selectors: ['select'], declarations: decls({ 'border-width': '1px', 'border-style': 'solid', 'border-color': 'rgb(118, 118, 118)', padding: '0px', 'background-color': 'rgb(239, 239, 239)', 'white-space': 'pre' }) },
  { selectors: ['textarea'], declarations: decls({ 'border-width': '1px', 'border-style': 'solid', 'border-color': 'rgb(118, 118, 118)', padding: '2px', 'background-color': 'rgb(255, 255, 255)', 'font-family': 'monospace', 'white-space': 'pre-wrap', overflow: 'auto' }) },

  // The disabled look Chrome computes for form controls (the disabled
  // controls' paint comes from the theme constants in layout/controls.ts;
  // these declarations are what getComputedStyle reports). The (0,1,1)+
  // specificities below outrank the per-control base rules above.
  { selectors: ['input:disabled'], declarations: decls({ color: 'rgb(84, 84, 84)', 'border-color': 'rgb(84, 84, 84)' }) },
  { selectors: ['input[type=text]:disabled', 'input[type=search]:disabled', 'input[type=password]:disabled', 'input[type=email]:disabled', 'input[type=number]:disabled', 'input[type=tel]:disabled', 'input[type=url]:disabled'], declarations: decls({ 'border-color': 'rgba(118, 118, 118, 0.3)', 'background-color': 'rgba(239, 239, 239, 0.3)' }) },
  { selectors: ['textarea:disabled'], declarations: decls({ color: 'rgb(84, 84, 84)', 'border-color': 'rgba(118, 118, 118, 0.3)', 'background-color': 'rgba(239, 239, 239, 0.3)' }) },
  { selectors: ['button:disabled'], declarations: decls({ color: 'rgba(16, 16, 16, 0.3)', 'border-color': 'rgba(118, 118, 118, 0.3)', 'background-color': 'rgba(239, 239, 239, 0.3)' }) },
  { selectors: ['select:disabled'], declarations: decls({ color: 'rgb(128, 128, 128)', 'border-color': 'rgba(118, 118, 118, 0.3)' }) },
];

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
