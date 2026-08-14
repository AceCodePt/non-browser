/**
 * Minimal selector engine over the parse5 DOM tree.
 *
 * Supports the selector surface the media-queries corpus exercises: type, id,
 * class, universal, compound selectors, descendant (space) and child (`>`)
 * combinators, and comma-separated selector lists. Specificity is computed per
 * CSS Selectors §9.2 (a: ids, b: classes, c: types) so rules from different
 * selectors can be ordered in the cascade. Pseudo-classes and attribute
 * selectors are skipped (not part of this task's corpus) — rules that use them
 * must not be authored in corpus/media-queries fixtures.
 */

import type { P5Element } from '../layout/types.js';

export interface CompoundSelector {
  tag: string | null;
  id: string | null;
  classes: string[];
  /** pseudo-element part (::before/::after or legacy :before/:after); null when absent. */
  pseudo: 'before' | 'after' | null;
}

export interface ComplexSelector {
  /** rightmost compound matches the element; earlier parts match ancestors. */
  parts: { combinator: ' ' | '>'; compound: CompoundSelector }[];
}

export type Specificity = [number, number, number];

function readIdentEnd(s: string, start: number): number {
  let i = start;
  while (i < s.length && /[A-Za-z0-9_-]/.test(s[i])) i++;
  return i;
}

/** Parse one complex selector (no leading/trailing combinators expected). */
export function parseSelector(input: string): ComplexSelector | null {
  const text = input.trim();
  if (text === '') return null;
  const parts: { combinator: ' ' | '>'; compound: CompoundSelector }[] = [];
  let cur: CompoundSelector = { tag: null, id: null, classes: [], pseudo: null };
  let lastCombinator: ' ' | '>' = ' ';
  let pendingSpace = false;

  const flush = (): void => {
    parts.push({ combinator: lastCombinator, compound: cur });
    cur = { tag: null, id: null, classes: [], pseudo: null };
  };

  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
      continue;
    }
    if (c === '>') {
      flush();
      lastCombinator = '>';
      pendingSpace = false;
      i++;
      continue;
    }
    if (pendingSpace) {
      flush();
      lastCombinator = ' ';
      pendingSpace = false;
    }
    if (c === '.') {
      const j = readIdentEnd(text, i + 1);
      const cls = text.slice(i + 1, j);
      if (cls) cur.classes.push(cls);
      i = j;
    } else if (c === '#') {
      const j = readIdentEnd(text, i + 1);
      cur.id = text.slice(i + 1, j);
      i = j;
    } else if (c === '*') {
      i++;
    } else if (c === '[') {
      // attribute selector — skip through the closing bracket (not supported)
      const close = text.indexOf(']', i);
      i = close < 0 ? n : close + 1;
    } else if (c === ':') {
      // `::before` / `::after`, or the legacy single-colon form. Any other
      // pseudo (class or element) is skipped — the engine does not match it.
      const j = readIdentEnd(text, i + 1);
      const name = text.slice(i + 1, j).toLowerCase();
      if (text[j] === ':') {
        const k = readIdentEnd(text, j + 1);
        const pname = text.slice(j + 1, k).toLowerCase();
        if (pname === 'before') cur.pseudo = 'before';
        else if (pname === 'after') cur.pseudo = 'after';
        i = k;
      } else if (name === 'before' || name === 'after') {
        cur.pseudo = name;
        i = j;
      } else {
        // pseudo-class — skip the identifier
        i = j;
      }
    } else {
      const j = readIdentEnd(text, i);
      if (j === i) {
        // Unexpected character (not an ident char): skip it rather than spin.
        i++;
      } else {
        const tag = text.slice(i, j);
        cur.tag = tag === '*' ? null : tag.toLowerCase();
        i = j;
      }
    }
  }
  flush();
  return { parts };
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
  return true;
}

function parentOf(el: P5Element): P5Element | null {
  const p = (el as unknown as { parentNode?: P5Element | null }).parentNode;
  return p && p.nodeName !== '#document' ? p : null;
}

/** Match a complex selector against an element (ancestors via parentNode). */
export function matchesComplex(sel: ComplexSelector, el: P5Element): boolean {
  const parts = sel.parts;
  const n = parts.length;
  if (n === 0) return false;
  if (!matchCompound(parts[n - 1].compound, el)) return false;
  let node: P5Element | null = el;
  for (let k = n - 1; k >= 1; k--) {
    if (!node) return false;
    if (parts[k].combinator === '>') {
      node = parentOf(node);
      if (!node || !matchCompound(parts[k - 1].compound, node)) return false;
    } else {
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
    }
  }
  return true;
}

/** Specificity of a complex selector: (ids, classes, types) summed over parts. */
export function specificity(sel: ComplexSelector): Specificity {
  let a = 0;
  let b = 0;
  let c = 0;
  for (const { compound } of sel.parts) {
    if (compound.id) a++;
    b += compound.classes.length;
    if (compound.tag) c++;
    // ::before/::after count as a type selector for specificity (CSS Pseudo-Elements §2.3).
    if (compound.pseudo) c++;
  }
  return [a, b, c];
}

export function compareSpecificity(x: Specificity, y: Specificity): number {
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return 0;
}
