/**
 * Media query parsing and evaluation (css-media-query-level-4 subset).
 *
 * The engine is a static renderer: @media is evaluated once per viewport input,
 * deterministically, against a `MediaEnvironment` that carries the viewport
 * dimensions and the media-feature inputs (prefers-color-scheme,
 * prefers-reduced-motion, resolution/dppx). There is no live browser surface.
 *
 * Supported grammar (the surface the media-queries corpus exercises):
 *   - media types `all` / `screen` / `print` (bare, or after `not` / `only`)
 *   - feature queries `(feature)` and `(feature: value)`
 *   - min- and max- prefixed features, plus exact `(width: Npx)` /
 *     `(height: Npx)` matches
 *   - aspect-ratio (and min-/max-), orientation, prefers-color-scheme,
 *     prefers-reduced-motion, resolution
 *   - `and`, `or`, `not` composition (or/and as media-in-parens lists), and
 *     comma-separated media query lists (OR across queries)
 *
 * Range syntax (`(width > 300px)`) is only valid inside @container and is
 * handled by the container query parser in phases/media-queries.ts.
 */

export type MediaOp = 'eq' | 'min' | 'max' | 'flag' | 'lt' | 'gt' | 'lte' | 'gte';

export type MediaCondition =
  | { type: 'and'; children: MediaCondition[] }
  | { type: 'or'; children: MediaCondition[] }
  | { type: 'not'; child: MediaCondition }
  | { type: 'type'; value: string }
  | { type: 'feature'; name: string; op: MediaOp; value: string | null };

export interface MediaQuery {
  condition: MediaCondition;
}

/** The viewport input and the media-feature environment a query evaluates against. */
export interface MediaEnvironment {
  width: number;
  height: number;
  /** prefers-color-scheme; default 'light'. */
  prefersColorScheme?: 'light' | 'dark';
  /** prefers-reduced-motion; default 'no-preference'. */
  prefersReducedMotion?: 'no-preference' | 'reduce';
  /** device resolution in dppx; default 1. */
  dppx?: number;
}

export type Token = string;

/** Tokenize a condition/prelude string into tokens (parens, ':', '/', ',', identifiers). */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(' || c === ')' || c === ':' || c === '/' || c === ',') {
      tokens.push(c);
      i++;
      continue;
    }
    let j = i;
    while (j < n && !/[\s(),:\/]/.test(input[j])) j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

/** Split a token list on a top-level separator token (paren depth 0). */
export function splitTopLevel(tokens: Token[], sep: string): Token[][] {
  const out: Token[][] = [];
  let depth = 0;
  let cur: Token[] = [];
  for (const t of tokens) {
    if (t === '(') depth++;
    else if (t === ')') depth--;
    if (t === sep && depth === 0) {
      out.push(cur);
      cur = [];
    } else {
      cur.push(t);
    }
  }
  out.push(cur);
  return out;
}

/** Does this token list contain an `and`/`or` at paren depth 0? */
export function hasTopLevelOperator(tokens: Token[]): boolean {
  let depth = 0;
  for (const t of tokens) {
    if (t === '(') depth++;
    else if (t === ')') depth--;
    else if ((t === 'and' || t === 'or') && depth === 0) return true;
  }
  return false;
}

/** Are the outer tokens a balanced `( ... )` pair wrapping the whole list? */
function balancedWrap(tokens: Token[]): boolean {
  if (tokens.length < 2 || tokens[0] !== '(' || tokens[tokens.length - 1] !== ')') return false;
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '(') depth++;
    else if (t === ')') depth--;
    if (depth === 0 && i < tokens.length - 1) return false;
  }
  return depth === 0;
}

function parseOr(tokens: Token[]): MediaCondition | null {
  const parts = splitTopLevel(tokens, 'or');
  if (parts.length === 1) return parseAnd(parts[0]);
  const children: MediaCondition[] = [];
  for (const p of parts) {
    const c = parseAnd(p);
    if (!c) return null;
    children.push(c);
  }
  return { type: 'or', children };
}

function parseAnd(tokens: Token[]): MediaCondition | null {
  const parts = splitTopLevel(tokens, 'and');
  if (parts.length === 1) return parseOperand(parts[0]);
  const children: MediaCondition[] = [];
  for (const p of parts) {
    const c = parseOperand(p);
    if (!c) return null;
    children.push(c);
  }
  return { type: 'and', children };
}

function parseFeature(inner: Token[]): MediaCondition | null {
  const nameTok = inner[0];
  if (!nameTok || nameTok === '(' || nameTok === ')') return null;
  const name = nameTok.toLowerCase();
  const colon = inner.indexOf(':');
  if (colon < 0) {
    if (inner.length !== 1) return null;
    return { type: 'feature', name, op: 'flag', value: null };
  }
  const value = inner.slice(colon + 1).join('');
  return { type: 'feature', name, op: 'eq', value };
}

function parseOperand(tokens: Token[]): MediaCondition | null {
  if (tokens.length === 0) return null;
  if (balancedWrap(tokens)) {
    const inner = tokens.slice(1, -1);
    if (hasTopLevelOperator(inner)) return parseOr(inner);
    return parseFeature(inner);
  }
  if (tokens.length === 1) return { type: 'type', value: tokens[0] };
  return null;
}

/**
 * Parse one media query. Returns null when the tokens don't form a query the
 * engine understands (the caller drops the rule, matching a browser's
 * parse-error recovery).
 */
export function parseQuery(tokens: Token[]): MediaCondition | null {
  if (tokens.length === 0) return null;
  if (tokens[0] === 'not') {
    const child = parseOr(tokens.slice(1));
    return child ? { type: 'not', child } : null;
  }
  if (tokens[0] === 'only') {
    // `only <media-type>` — the `only` keyword is a legacy no-op modifier.
    const child = parseOr(tokens.slice(1));
    return child ?? null;
  }
  return parseOr(tokens);
}

/** Parse a full @media prelude (a comma-separated media query list). */
export function parseMediaQueryList(input: string): MediaQuery[] | null {
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;
  const groups = splitTopLevel(tokens, ',');
  const queries: MediaQuery[] = [];
  for (const g of groups) {
    const cond = parseQuery(g);
    if (!cond) return null;
    queries.push({ condition: cond });
  }
  return queries;
}

function parseMediaLength(value: string): number | null {
  const m = value.match(/^(-?[\d.]+)(px|em|rem)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? 'px';
  // em/rem in media queries resolve against the initial font size (16px).
  return unit === 'px' ? v : v * 16;
}

function parseRatio(value: string): [number, number] | null {
  const parts = value.split('/');
  if (parts.length === 1) {
    const v = parseFloat(parts[0]);
    return Number.isFinite(v) ? [v, 1] : null;
  }
  if (parts.length === 2) {
    const a = parseFloat(parts[0]);
    const b = parseFloat(parts[1]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return [a, b];
  }
  return null;
}

function parseResolution(value: string): number | null {
  const m = value.match(/^([\d.]+)\s*(x|dppx|dpi|dpcm)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  const unit = m[2] ?? 'dppx';
  if (unit === 'x' || unit === 'dppx') return v;
  if (unit === 'dpi') return v / 96;
  if (unit === 'dpcm') return (v * 2.54) / 96;
  return null;
}

function compareNum(current: number, target: number, op: MediaOp): boolean {
  switch (op) {
    case 'eq':
      return current === target;
    case 'min':
      return current >= target;
    case 'max':
      return current <= target;
    case 'lt':
      return current < target;
    case 'gt':
      return current > target;
    case 'lte':
      return current <= target;
    case 'gte':
      return current >= target;
    default:
      return false;
  }
}

/** Evaluate a single media feature against the environment. */
export function evaluateFeature(cond: { name: string; op: MediaOp; value: string | null }, env: MediaEnvironment): boolean {
  const rawName = cond.name.toLowerCase();
  let base = rawName;
  let op = cond.op;
  if (rawName.startsWith('min-')) {
    base = rawName.slice(4);
    op = op === 'eq' ? 'min' : op;
  } else if (rawName.startsWith('max-')) {
    base = rawName.slice(4);
    op = op === 'eq' ? 'max' : op;
  }
  const value = cond.value ?? '';

  switch (base) {
    case 'width': {
      const target = parseMediaLength(value);
      return target !== null && compareNum(env.width, target, op);
    }
    case 'height': {
      const target = parseMediaLength(value);
      return target !== null && compareNum(env.height, target, op);
    }
    case 'aspect-ratio': {
      const r = parseRatio(value);
      if (!r) return false;
      const [a, b] = r;
      // compare env.width/env.height vs a/b exactly via cross multiplication
      const lhs = env.width * b;
      const rhs = env.height * a;
      switch (op) {
        case 'eq':
          return lhs === rhs;
        case 'min':
          return lhs >= rhs;
        case 'max':
          return lhs <= rhs;
        default:
          return false;
      }
    }
    case 'orientation': {
      const portrait = env.height >= env.width;
      if (value === 'portrait') return portrait;
      if (value === 'landscape') return !portrait;
      return false;
    }
    case 'prefers-color-scheme': {
      return (env.prefersColorScheme ?? 'light') === value;
    }
    case 'prefers-reduced-motion': {
      return (env.prefersReducedMotion ?? 'no-preference') === value;
    }
    case 'resolution': {
      const target = parseResolution(value);
      if (target === null) return false;
      const cur = env.dppx ?? 1;
      const eps = 1e-9;
      switch (op) {
        case 'eq':
          return Math.abs(cur - target) < eps;
        case 'min':
          return cur >= target - eps;
        case 'max':
          return cur <= target + eps;
        default:
          return false;
      }
    }
    case 'color':
      // Every supported renderer is 8-bit color. `(color)` is true; bit-depth
      // queries against 8 bits.
      if (op === 'flag') return true;
      return parseInt(value, 10) <= 8;
    case 'monochrome':
      if (op === 'flag') return false;
      return parseInt(value, 10) <= 0;
    default:
      // Unknown features never match, matching parse-error recovery.
      return false;
  }
}

export function evaluateCondition(cond: MediaCondition, env: MediaEnvironment): boolean {
  switch (cond.type) {
    case 'and':
      return cond.children.every((c) => evaluateCondition(c, env));
    case 'or':
      return cond.children.some((c) => evaluateCondition(c, env));
    case 'not':
      return !evaluateCondition(cond.child, env);
    case 'type':
      return cond.value === 'all' || cond.value === 'screen';
    case 'feature':
      return evaluateFeature(cond, env);
  }
}

/** A media query list (one @media prelude) matches when any query matches. */
export function evaluateMediaQueryList(queries: MediaQuery[], env: MediaEnvironment): boolean {
  return queries.some((q) => evaluateCondition(q.condition, env));
}
