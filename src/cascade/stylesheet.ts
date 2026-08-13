/**
 * CSS stylesheet parser feeding the cascade phases.
 *
 * Consumes the raw text of a `<style>` element and produces a list of rules,
 * each carrying its declarations plus the enclosing @media / @container
 * condition groups. Nested at-rules are flattened: an inner rule inherits the
 * enclosing @media's query list (a rule applies only when every enclosing
 * @media group matches) and the enclosing @container groups.
 *
 * At-rules the media-queries task does not own (@import, @font-face,
 * @supports, @keyframes, ...) are skipped with brace-aware recovery — the
 * cascade simply never sees their rules. This task's fixtures do not use them.
 */

import type { Declaration } from '../layout/css.js';
import { parseDeclarationBlock } from '../layout/css.js';
import { parseMediaQueryList, type MediaQuery, type Token, tokenize, splitTopLevel, hasTopLevelOperator } from './media.js';

export interface ContainerGroup {
  /** container-name from the prelude, or null when none is given. */
  name: string | null;
  /** parsed container condition; null when the prelude has no condition. */
  condition: MediaQuery | null;
}

export interface CascadeRule {
  selectors: string[];
  declarations: Declaration[];
  /** one entry per enclosing @media; the rule needs every group to match. */
  mediaGroups: MediaQuery[][];
  /** one entry per enclosing @container. */
  containerGroups: ContainerGroup[];
  /** global source order across all stylesheets (ties break by this). */
  order: number;
}

export interface StyleSheet {
  rules: CascadeRule[];
}

/** Strip /* ... *\/ comments (string-aware) from CSS text. */
function stripComments(css: string): string {
  let out = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        const d = css[i];
        out += d;
        if (d === '\\' && i + 1 < n) {
          out += css[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (d === quote) break;
      }
      continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Content of a balanced `{ ... }` block whose opening brace is at `braceIndex`. */
function readBalancedBlock(css: string, braceIndex: number): string {
  let depth = 0;
  let i = braceIndex;
  const n = css.length;
  while (i < n) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(braceIndex + 1, i);
    }
    i++;
  }
  return css.slice(braceIndex + 1);
}

/** Index of the closing brace matching the block opened at `braceIndex`. */
function findClosingBrace(css: string, braceIndex: number): number {
  let depth = 0;
  let i = braceIndex;
  const n = css.length;
  while (i < n) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return n - 1;
}

/** Scan an at-rule prelude; stop at `{` or `;` at paren depth 0. */
function readAtPrelude(css: string, start: number): { end: number; hasBlock: boolean } {
  let depth = 0;
  let i = start;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if ((c === '{' || c === ';') && depth === 0) {
      return { end: i, hasBlock: c === '{' };
    }
    i++;
  }
  return { end: n, hasBlock: false };
}

function readIdentEnd(s: string, start: number): number {
  let i = start;
  while (i < s.length && /[A-Za-z0-9_-]/.test(s[i])) i++;
  return i;
}

/** Split a selector prelude on top-level commas. */
function splitSelectors(prelude: string): string[] {
  return splitTopLevel(tokenize(prelude), ',')
    .map((t) => t.join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Container prelude: `@container [<name>] <condition>` -> name + condition. */
export function parseContainerPrelude(prelude: string): ContainerGroup {
  const tokens = tokenize(prelude);
  let name: string | null = null;
  let rest = tokens;
  if (rest.length > 0 && rest[0] !== '(' && rest[0] !== 'not') {
    name = rest[0];
    rest = rest.slice(1);
  }
  const condition = rest.length > 0 ? parseContainerCondition(rest) : null;
  return { name, condition };
}

/**
 * Parse a @container condition into a media-query-shaped tree (and/or/not over
 * parenthesized size features). Supports `(min-width: Npx)`, `(max-width: Npx)`,
 * `(width: Npx)`, range syntax `(width > Npx)`, `(<, <=, >=, ==)`, and
 * `(aspect-ratio: A/B)`.
 */
export function parseContainerCondition(tokens: Token[]): MediaQuery | null {
  const cond = parseContainerCond(tokens);
  return cond ? { condition: cond } : null;
}

function parseContainerCond(tokens: Token[]): import('./media.js').MediaCondition | null {
  if (tokens.length === 0) return null;
  if (tokens[0] === 'not') {
    const child = parseContainerCond(tokens.slice(1));
    return child ? { type: 'not', child } : null;
  }
  const orParts = splitTopLevel(tokens, 'or');
  if (orParts.length > 1) {
    const children: import('./media.js').MediaCondition[] = [];
    for (const p of orParts) {
      const c = parseContainerAnd(p);
      if (!c) return null;
      children.push(c);
    }
    return { type: 'or', children };
  }
  return parseContainerAnd(tokens);
}

function parseContainerAnd(tokens: Token[]): import('./media.js').MediaCondition | null {
  const andParts = splitTopLevel(tokens, 'and');
  if (andParts.length > 1) {
    const children: import('./media.js').MediaCondition[] = [];
    for (const p of andParts) {
      const c = parseContainerOperand(p);
      if (!c) return null;
      children.push(c);
    }
    return { type: 'and', children };
  }
  return parseContainerOperand(andParts[0]);
}

function parseContainerOperand(tokens: Token[]): import('./media.js').MediaCondition | null {
  if (tokens.length >= 2 && tokens[0] === '(' && tokens[tokens.length - 1] === ')') {
    const inner = tokens.slice(1, -1);
    if (hasTopLevelOperator(inner)) return parseContainerCond(inner);
    return parseContainerFeature(inner);
  }
  return null;
}

const RANGE_OPS: Record<string, import('./media.js').MediaOp> = {
  '<': 'lt',
  '>': 'gt',
  '<=': 'lte',
  '>=': 'gte',
  '=': 'eq',
  '==': 'eq',
};

function parseContainerFeature(inner: Token[]): import('./media.js').MediaCondition | null {
  const name = inner[0]?.toLowerCase();
  if (!name) return null;
  // range syntax: name <op> value  (3 tokens)
  if (inner.length === 3 && !inner.includes(':')) {
    const op = RANGE_OPS[inner[1]];
    if (op) return { type: 'feature', name, op, value: inner[2] };
    return null;
  }
  const colon = inner.indexOf(':');
  if (colon > 0) {
    const value = inner.slice(colon + 1).join('');
    let base = name;
    let op: import('./media.js').MediaOp = 'eq';
    if (name.startsWith('min-')) {
      base = name.slice(4);
      op = 'min';
    } else if (name.startsWith('max-')) {
      base = name.slice(4);
      op = 'max';
    }
    return { type: 'feature', name: base, op, value };
  }
  if (inner.length === 1) return { type: 'feature', name, op: 'flag', value: null };
  return null;
}

interface ParseState {
  mediaGroups: MediaQuery[][];
  containerGroups: ContainerGroup[];
}

/** Parse a stylesheet's text into flattened rules. */
export function parseStylesheet(css: string): StyleSheet {
  const text = stripComments(css);
  const rules: CascadeRule[] = [];
  let order = 0;
  const state: ParseState = { mediaGroups: [], containerGroups: [] };
  parseTopLevel(text, state, rules, () => order++);
  return { rules };
}

function parseTopLevel(css: string, inherited: ParseState, rules: CascadeRule[], nextOrder: () => number): void {
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    if (css[i] === '@') {
      const j = readIdentEnd(css, i + 1);
      const name = css.slice(i + 1, j);
      const { end, hasBlock } = readAtPrelude(css, j);
      const prelude = css.slice(j, end).trim();
      if (name === 'media') {
        const queries = parseMediaQueryList(prelude);
        if (hasBlock) {
          const block = readBalancedBlock(css, end);
          parseTopLevel(block, { mediaGroups: [...inherited.mediaGroups, queries ?? []], containerGroups: inherited.containerGroups }, rules, nextOrder);
          i = findClosingBrace(css, end) + 1;
        } else {
          i = end + 1;
        }
      } else if (name === 'container') {
        const group = parseContainerPrelude(prelude);
        if (hasBlock) {
          const block = readBalancedBlock(css, end);
          parseTopLevel(block, { mediaGroups: inherited.mediaGroups, containerGroups: [...inherited.containerGroups, group] }, rules, nextOrder);
          i = findClosingBrace(css, end) + 1;
        } else {
          i = end + 1;
        }
      } else if (hasBlock) {
        i = findClosingBrace(css, end) + 1;
      } else {
        i = end + 1;
      }
      continue;
    }
    // style rule
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selectors = splitSelectors(css.slice(i, open));
    const block = readBalancedBlock(css, open);
    i = findClosingBrace(css, open) + 1;
    if (selectors.length === 0) continue;
    const declarations = parseDeclarationBlock(block);
    rules.push({
      selectors,
      declarations,
      mediaGroups: inherited.mediaGroups,
      containerGroups: inherited.containerGroups,
      order: nextOrder(),
    });
  }
}
