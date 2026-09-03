/**
 * Selector engine over the parse5 DOM tree (css-selectors-4 surface).
 *
 * Supports: type, id, class, universal, compound selectors, the four
 * combinators (descendant ` `, child `>`, adjacent `+`, general sibling `~`),
 * attribute selectors with all operators ([attr], =, ~=, |=, ^=, $=, *=) plus
 * the i/s case flags, the functional pseudo-classes :not()/:is()/:where() with
 * full selector-list arguments (balanced-paren, string-aware parsing), the
 * structural and root pseudo-classes (:root, :empty, :first/last/only-child,
 * :nth-child(An+B), :nth-last-child, :first/last/only-of-type,
 * :nth-of-type(An+B), :nth-last-of-type), ::before/::after, and the statically
 * matchable form-state pseudo-classes :checked/:disabled/:enabled (HTML
 * Selectors §6.6.2/§6.6.4: matched from the checked/selected/disabled
 * *attributes* — a static renderer has no interaction state; :disabled/
 * :enabled only ever match the enableable elements button, input, select,
 * textarea, option, optgroup and fieldset). Specificity is
 * computed per CSS Selectors §9.2 with §3.2's functional rules: :is() and
 * :not() contribute the component-wise maximum of their arguments'
 * specificities, :where() contributes zero.
 *
 * A selector that fails to parse returns null and the caller drops the rule —
 * parse-error recovery, like a browser.
 */

import type { P5Element } from '../layout/types.js';

export interface AttrSelector {
  name: string;
  op: 'none' | '=' | '~=' | '|=' | '^=' | '$=' | '*=';
  value: string;
  caseInsensitive: boolean;
}

export interface FunctionalPseudo {
  kind: 'not' | 'is' | 'where';
  selectors: ComplexSelector[];
}

/** Structural/root pseudo-classes; nth-* carry the parsed An+B. */
export interface StructuralPseudo {
  kind:
    | 'root'
    | 'empty'
    | 'first-child'
    | 'last-child'
    | 'only-child'
    | 'nth-child'
    | 'nth-last-child'
    | 'first-of-type'
    | 'last-of-type'
    | 'only-of-type'
    | 'nth-of-type'
    | 'nth-last-of-type';
  an: number;
  bn: number;
}

export interface CompoundSelector {
  tag: string | null;
  id: string | null;
  classes: string[];
  attrs: AttrSelector[];
  functional: FunctionalPseudo[];
  structural: StructuralPseudo[];
  /** Statically matched state pseudo-classes: checked / disabled / enabled. */
  state: string[];
  pseudo: 'before' | 'after' | null;
}

export type Combinator = ' ' | '>' | '+' | '~';

export interface ComplexSelector {
  /** rightmost compound matches the element; earlier parts match per combinator. */
  parts: { combinator: Combinator; compound: CompoundSelector }[];
}

export type Specificity = [number, number, number];

const ATTR_OPS = ['~=', '|=', '^=', '$=', '*='];

const STRUCTURAL_PSEUDOS = new Set([
  'root',
  'empty',
  'first-child',
  'last-child',
  'only-child',
  'nth-child',
  'nth-last-child',
  'first-of-type',
  'last-of-type',
  'only-of-type',
  'nth-of-type',
  'nth-last-of-type',
]);

/**
 * css-selectors-4 §6.5 An+B microgrammar: odd/even, bare integers, An forms
 * with optional sign and whitespace around the trailing +/-B, case-insensitive
 * `n`. Anything else (e.g. `n+b`, `2n++1`, `+ n`) is invalid and fails the
 * whole selector (parse-error recovery).
 */
export function parseAnPlusB(text: string): { an: number; bn: number } | null {
  const s = text.trim().toLowerCase();
  if (s === 'odd') return { an: 2, bn: 1 };
  if (s === 'even') return { an: 2, bn: 0 };
  const full = /^([+-]?)(\d*)n\s*([+-])\s*(\d+)$/.exec(s);
  if (full) {
    const a = (full[1] === '-' ? -1 : 1) * (full[2] === '' ? 1 : Number.parseInt(full[2], 10));
    const b = (full[3] === '-' ? -1 : 1) * Number.parseInt(full[4], 10);
    return { an: a, bn: b };
  }
  const anOnly = /^([+-]?\d*)n$/.exec(s);
  if (anOnly) {
    const a = (anOnly[1].startsWith('-') ? -1 : 1) * (anOnly[1].replace(/[+-]/, '') === '' ? 1 : Number.parseInt(anOnly[1].replace(/[+-]/, ''), 10));
    return { an: a, bn: 0 };
  }
  if (/^[+-]?\d+$/.test(s)) return { an: 0, bn: Number.parseInt(s, 10) };
  return null;
}

const STATE_PSEUDOS = new Set(['checked', 'disabled', 'enabled']);

/** Elements :disabled/:enabled can ever match (HTML enableable elements); a
 * `disabled` attribute on anything else is inert, matching Chrome. */
const ENABLEABLE = new Set(['input', 'select', 'textarea', 'button', 'option', 'optgroup', 'fieldset']);

function hasAttr(el: P5Element, name: string): boolean {
  return el.attrs.some((a) => a.name === name);
}

/** Input types whose :checked reflects the checked attribute (a static
 * renderer has no activation). `option[selected]` also matches :checked. */
const CHECKABLE_TYPES = new Set(['checkbox', 'radio']);

function matchStatePseudo(el: P5Element, name: string): boolean {
  switch (name) {
    case 'checked':
      if (el.nodeName === 'input') {
        const type = el.attrs.find((a) => a.name === 'type')?.value.toLowerCase() ?? 'text';
        return CHECKABLE_TYPES.has(type) && hasAttr(el, 'checked');
      }
      return el.nodeName === 'option' && hasAttr(el, 'selected');
    case 'disabled':
      return ENABLEABLE.has(el.nodeName) && hasAttr(el, 'disabled');
    case 'enabled':
      return ENABLEABLE.has(el.nodeName) && !hasAttr(el, 'disabled');
  }
  return false;
}

function isIdentChar(c: string): boolean {
  return /[A-Za-z0-9_-]/.test(c);
}

/** Chars that can begin a simple selector: idents, universal, class, id,
 * attribute, pseudo. */
function startsSimple(c: string): boolean {
  return isIdentChar(c) || c === '*' || c === '.' || c === '#' || c === '[' || c === ':';
}

function emptyCompound(): CompoundSelector {
  return { tag: null, id: null, classes: [], attrs: [], functional: [], structural: [], state: [], pseudo: null };
}

class SelectorParser {
  private i = 0;

  constructor(private readonly text: string) {}

  private eof(): boolean {
    return this.i >= this.text.length;
  }

  parseComplex(): ComplexSelector | null {
    const parts: { combinator: Combinator; compound: CompoundSelector }[] = [];
    let cur = emptyCompound();
    let started = false;
    let lastCombinator: Combinator = ' ';
    let pendingSpace = false;
    const flush = (): void => {
      parts.push({ combinator: lastCombinator, compound: cur });
      cur = emptyCompound();
      started = false;
    };
    while (!this.eof()) {
      const c = this.text[this.i];
      if (/\s/.test(c)) {
        pendingSpace = true;
        this.i++;
        continue;
      }
      if (c === '>' || c === '+' || c === '~') {
        if (!started) return null;
        flush();
        lastCombinator = c;
        pendingSpace = false;
        this.i++;
        continue;
      }
      if (started && pendingSpace) {
        flush();
        lastCombinator = ' ';
        pendingSpace = false;
      }
      // A compound is a maximal run of simple selectors (div.cls[a]:not(b)).
      do {
        if (!this.parseSimple(cur)) return null;
        started = true;
      } while (!this.eof() && startsSimple(this.text[this.i]));
    }
    if (started) flush();
    if (parts.length === 0) return null;
    return { parts };
  }

  /** One simple selector appended to `compound`; false on parse failure. */
  private parseSimple(compound: CompoundSelector): boolean {
    const c = this.text[this.i];
    if (c === '*') {
      this.i++;
      return true;
    }
    if (c === '.') {
      this.i++;
      const name = this.readIdent();
      if (!name) return false;
      compound.classes.push(name);
      return true;
    }
    if (c === '#') {
      this.i++;
      const name = this.readIdent();
      if (!name) return false;
      compound.id = name;
      return true;
    }
    if (c === '[') {
      const attr = this.parseAttr();
      if (!attr) return false;
      compound.attrs.push(attr);
      return true;
    }
    if (c === ':') {
      return this.parsePseudo(compound);
    }
    if (isIdentChar(c)) {
      if (compound.tag) return false;
      compound.tag = this.readIdent().toLowerCase();
      return true;
    }
    return false;
  }

  private readIdent(): string {
    const start = this.i;
    while (!this.eof() && isIdentChar(this.text[this.i])) this.i++;
    return this.text.slice(start, this.i);
  }

  private parseAttr(): AttrSelector | null {
    this.i++; // '['
    const close = this.findMatchingBracket();
    if (close === null) return null;
    const body = this.text.slice(this.i, close);
    this.i = close + 1;
    let j = 0;
    const n = body.length;
    const skipWs = (): void => {
      while (j < n && /\s/.test(body[j])) j++;
    };
    skipWs();
    // The name scan stops before operator starts (~, |, ^, $, *), '=' and the
    // closing bracket — a CSS ident never contains those.
    const nameStart = j;
    while (j < n && !/[\s\]=~|^$*]/.test(body[j])) j++;
    const name = body.slice(nameStart, j);
    if (!name || /^[\d]/.test(name)) return null;
    skipWs();
    let op: AttrSelector['op'] = 'none';
    if (body[j] === '=') {
      op = '=';
      j++;
    } else if (j + 1 < n && ATTR_OPS.includes(body.slice(j, j + 2))) {
      op = body.slice(j, j + 2) as AttrSelector['op'];
      j += 2;
    }
    let value = '';
    let caseInsensitive = false;
    if (op !== 'none') {
      skipWs();
      const q = body[j];
      if (q === '"' || q === "'") {
        j++;
        let v = '';
        while (j < n && body[j] !== q) {
          if (body[j] === '\\' && j + 1 < n) {
            v += body[j + 1];
            j += 2;
            continue;
          }
          v += body[j];
          j++;
        }
        if (j >= n) return null;
        j++;
        value = v;
      } else {
        const start = j;
        while (j < n && !/\s/.test(body[j])) j++;
        value = body.slice(start, j);
      }
      skipWs();
      // Trailing case flag: `i` (case-insensitive) or `s` (case-sensitive,
      // the default), itself case-insensitive per css-selectors-4 §6.3.
      if (j < n && (body[j] === 'i' || body[j] === 'I' || body[j] === 's' || body[j] === 'S')) {
        caseInsensitive = body[j] === 'i' || body[j] === 'I';
        j++;
        skipWs();
      }
      if (j < n) return null;
    } else {
      skipWs();
      if (j < n) return null;
    }
    return { name, op, value, caseInsensitive };
  }

  private findMatchingBracket(): number | null {
    let quote: string | null = null;
    for (let j = this.i + 1; j < this.text.length; j++) {
      const c = this.text[j];
      if (quote) {
        if (c === '\\') j++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === ']') return j;
    }
    return null;
  }

  /**
   * One pseudo at this.i (the ':'). `::name` and the legacy single-colon
   * `:before`/`:after` set the compound's pseudo-element slot; `:not(...)` /
   * `:is(...)` / `:where(...)` parse a balanced argument block as a selector
   * list; structural/root pseudo-classes match per css-selectors-4 §6.5-§6.7,
   * the nth-* ones parsing their An+B argument; the form-state pseudo-classes
   * :checked/:disabled/:enabled match statically from the element's attributes
   * (a static renderer has no interaction state to consult). Any other
   * pseudo-class fails the selector — the engine does not match it
   * (interaction states like :hover/:focus are outside this surface).
   */
  private parsePseudo(compound: CompoundSelector): boolean {
    this.i++; // ':'
    let element = false;
    if (this.text[this.i] === ':') {
      element = true;
      this.i++;
    }
    const name = this.readIdent().toLowerCase();
    if (!name) return false;
    if (this.text[this.i] === '(') {
      if (element) return false;
      if (name === 'not' || name === 'is' || name === 'where') {
        const close = this.findMatchingParen();
        if (close === null) return false;
        const list = parseSelectorList(this.text.slice(this.i + 1, close));
        if (!list) return false;
        compound.functional.push({ kind: name, selectors: list });
        this.i = close + 1;
        return true;
      }
      if (name === 'nth-child' || name === 'nth-last-child' || name === 'nth-of-type' || name === 'nth-last-of-type') {
        const close = this.findMatchingParen();
        if (close === null) return false;
        const anb = parseAnPlusB(this.text.slice(this.i + 1, close));
        if (!anb) return false;
        compound.structural.push({ kind: name, an: anb.an, bn: anb.bn });
        this.i = close + 1;
        return true;
      }
      return false;
    }
    if (name === 'before' || name === 'after') {
      compound.pseudo = name;
      return true;
    }
    if (STRUCTURAL_PSEUDOS.has(name)) {
      compound.structural.push({ kind: name as StructuralPseudo['kind'], an: 0, bn: 0 });
      return true;
    }
    if (STATE_PSEUDOS.has(name)) {
      compound.state.push(name);
      return true;
    }
    return false;
  }

  private findMatchingParen(): number | null {
    let depth = 0;
    let quote: string | null = null;
    for (let j = this.i; j < this.text.length; j++) {
      const c = this.text[j];
      if (quote) {
        if (c === '\\') j++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) return j;
      }
    }
    return null;
  }
}

/** Parse a comma-separated selector list (each entry a full complex selector). */
export function parseSelectorList(input: string): ComplexSelector[] | null {
  const out: ComplexSelector[] = [];
  let depth = 0;
  let quote: string | null = null;
  let bracket = 0;
  let cur = '';
  const flush = (): boolean => {
    const trimmed = cur.trim();
    cur = '';
    if (trimmed === '') return false;
    const sel = parseSelector(trimmed);
    if (!sel) return false;
    out.push(sel);
    return true;
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < input.length) {
        cur += input[i + 1];
        i++;
      } else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === '[') bracket++;
    else if (c === ']') bracket--;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    if (c === ',' && depth === 0 && bracket === 0) {
      if (!flush()) return null;
      continue;
    }
    cur += c;
  }
  if (!flush()) return null;
  return out.length > 0 ? out : null;
}

/**
 * Parse one complex selector. Returns null when the text isn't a selector the
 * engine supports (the caller drops the rule, matching a browser's
 * parse-error recovery).
 */
export function parseSelector(input: string): ComplexSelector | null {
  const text = input.trim();
  if (text === '') return null;
  return new SelectorParser(text).parseComplex();
}

function matchAttr(el: P5Element, a: AttrSelector): boolean {
  const raw = el.attrs.find((x) => x.name === a.name)?.value;
  if (raw === undefined) return false;
  let v = raw;
  let val = a.value;
  if (a.caseInsensitive) {
    v = v.toLowerCase();
    val = val.toLowerCase();
  }
  switch (a.op) {
    case 'none':
      return true;
    case '=':
      return v === val;
    case '~=':
      return val !== '' && !/\s/.test(val) && v.split(/\s+/).includes(val);
    case '|=':
      return v === val || v.startsWith(val + '-');
    case '^=':
      return val !== '' && v.startsWith(val);
    case '$=':
      return val !== '' && v.endsWith(val);
    case '*=':
      return val !== '' && v.includes(val);
  }
}

function matchFunctional(f: FunctionalPseudo, el: P5Element): boolean {
  const any = f.selectors.some((arg) => matchesComplex(arg, el));
  return f.kind === 'not' ? !any : any;
}

/** The raw parent, including the #document above the root element. */
function rawParent(el: P5Element): P5Element | null {
  return (el as unknown as { parentNode?: P5Element | null }).parentNode ?? null;
}

function isElementNode(n: unknown): n is P5Element {
  return typeof n === 'object' && n !== null && (n as P5Element).nodeName !== undefined && (n as P5Element).nodeName !== '#text' && (n as P5Element).nodeName !== '#comment';
}

function elementSiblings(el: P5Element): P5Element[] {
  const p = rawParent(el);
  return ((p as unknown as { childNodes?: unknown[] })?.childNodes ?? []).filter(isElementNode);
}

/** Position of el among its element siblings (0-based). */
function elementIndex(el: P5Element): number {
  return elementSiblings(el).indexOf(el);
}

/** 1-based position matches an+b iff ∃n ≥ 0: position = an·n + b. */
function matchesAnB(an: number, bn: number, position: number): boolean {
  if (an === 0) return position === bn;
  const d = position - bn;
  return d % an === 0 && d / an >= 0;
}

function matchStructural(st: StructuralPseudo, el: P5Element): boolean {
  switch (st.kind) {
    case 'root':
      // The root element's parent is the #document itself.
      return rawParent(el) !== null && (rawParent(el) as P5Element).nodeName === '#document';
    case 'empty':
      // Selectors §6.6.7: children other than comments make the element
      // non-empty — text nodes, including whitespace-only ones, count.
      return el.childNodes.every((c) => c.nodeName === '#comment');
    case 'first-child':
      return elementIndex(el) === 0;
    case 'last-child':
      return elementIndex(el) === elementSiblings(el).length - 1;
    case 'only-child':
      return elementSiblings(el).length === 1;
    case 'nth-child':
      return matchesAnB(st.an, st.bn, elementIndex(el) + 1);
    case 'nth-last-child':
      return matchesAnB(st.an, st.bn, elementSiblings(el).length - elementIndex(el));
    case 'first-of-type':
      return elementSiblings(el).filter((s) => s.nodeName === el.nodeName)[0] === el;
    case 'last-of-type':
      return elementSiblings(el).filter((s) => s.nodeName === el.nodeName).at(-1) === el;
    case 'only-of-type':
      return elementSiblings(el).filter((s) => s.nodeName === el.nodeName).length === 1;
    case 'nth-of-type':
      return matchesAnB(st.an, st.bn, elementSiblings(el).filter((s) => s.nodeName === el.nodeName).indexOf(el) + 1);
    case 'nth-last-of-type':
      return matchesAnB(
        st.an,
        st.bn,
        elementSiblings(el).filter((s) => s.nodeName === el.nodeName).length - elementSiblings(el).filter((s) => s.nodeName === el.nodeName).indexOf(el),
      );
  }
}

function matchCompound(compound: CompoundSelector, el: P5Element): boolean {
  if (compound.tag && el.nodeName !== compound.tag) return false;
  if (compound.id !== null) {
    const a = el.attrs.find((x) => x.name === 'id');
    if (!a || a.value !== compound.id) return false;
  }
  if (compound.classes.length > 0) {
    const clsAttr = el.attrs.find((x) => x.name === 'class')?.value ?? '';
    const set = new Set(clsAttr.split(/\s+/).filter(Boolean));
    for (const c of compound.classes) {
      if (!set.has(c)) return false;
    }
  }
  for (const a of compound.attrs) {
    if (!matchAttr(el, a)) return false;
  }
  for (const st of compound.structural) {
    if (!matchStructural(st, el)) return false;
  }
  for (const s of compound.state) {
    if (!matchStatePseudo(el, s)) return false;
  }
  for (const f of compound.functional) {
    if (!matchFunctional(f, el)) return false;
  }
  return true;
}

function parentOf(el: P5Element): P5Element | null {
  const p = (el as unknown as { parentNode?: P5Element | null }).parentNode;
  return p && p.nodeName !== '#document' ? p : null;
}

function prevElementSibling(el: P5Element): P5Element | null {
  const p = (el as unknown as { parentNode?: P5Element | null }).parentNode;
  if (!p) return null;
  const siblings = (p as unknown as { childNodes?: unknown[] }).childNodes ?? [];
  const idx = siblings.indexOf(el);
  for (let j = idx - 1; j >= 0; j--) {
    const s = siblings[j] as P5Element | undefined;
    if (s && typeof s === 'object' && s.nodeName !== undefined && s.nodeName !== '#text' && s.nodeName !== '#comment') return s;
  }
  return null;
}

export function matchesComplex(sel: ComplexSelector, el: P5Element): boolean {
  const parts = sel.parts;
  const n = parts.length;
  if (n === 0) return false;
  if (!matchCompound(parts[n - 1].compound, el)) return false;
  let node: P5Element | null = el;
  for (let k = n - 1; k >= 1; k--) {
    if (!node) return false;
    switch (parts[k].combinator) {
      case '>':
        node = parentOf(node);
        if (!node || !matchCompound(parts[k - 1].compound, node)) return false;
        break;
      case ' ': {
        node = parentOf(node);
        let found = false;
        while (node) {
          if (matchCompound(parts[k - 1].compound, node)) {
            found = true;
            break;
          }
          node = parentOf(node);
        }
        if (!found) return false;
        break;
      }
      case '+':
        node = prevElementSibling(node);
        if (!node || !matchCompound(parts[k - 1].compound, node)) return false;
        break;
      case '~': {
        node = prevElementSibling(node);
        let found = false;
        while (node) {
          if (matchCompound(parts[k - 1].compound, node)) {
            found = true;
            break;
          }
          node = prevElementSibling(node);
        }
        if (!found) return false;
        break;
      }
    }
  }
  return true;
}

/** Component-wise max of two specificities (Selectors §3.2 for :is()/:not()). */
function maxSpecificity(a: Specificity, b: Specificity): Specificity {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
}

function specificityOfFunctional(f: FunctionalPseudo): Specificity {
  if (f.kind === 'where') return [0, 0, 0];
  let m: Specificity = [0, 0, 0];
  for (const arg of f.selectors) {
    m = maxSpecificity(m, specificity(arg));
  }
  return m;
}

function compoundSpecificity(compound: CompoundSelector): Specificity {
  let a = compound.id ? 1 : 0;
  let b = compound.classes.length + compound.attrs.length + compound.structural.length + compound.state.length;
  let c = (compound.tag ? 1 : 0) + (compound.pseudo ? 1 : 0);
  for (const f of compound.functional) {
    const s = specificityOfFunctional(f);
    a += s[0];
    b += s[1];
    c += s[2];
  }
  return [a, b, c];
}

export function specificity(sel: ComplexSelector): Specificity {
  const total: Specificity = [0, 0, 0];
  for (const { compound } of sel.parts) {
    const s = compoundSpecificity(compound);
    total[0] += s[0];
    total[1] += s[1];
    total[2] += s[2];
  }
  return total;
}

export function compareSpecificity(x: Specificity, y: Specificity): number {
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}
