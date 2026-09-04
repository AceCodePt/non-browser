/**
 * Media query parsing and evaluation (css-media-query-level-4 subset).
 *
 * The engine is a static renderer: @media is evaluated once per viewport input,
 * deterministically, against a `MediaEnvironment` that carries the viewport
 * dimensions and the media-feature inputs (prefers-color-scheme,
 * prefers-reduced-motion, resolution/dppx). There is no live browser surface.
 *
 * Supported grammar (the surface the media-queries corpus exercises):
 *   - media types `all` / `screen` (bare, or after `not` / `only`); `print`
 *     is parsed but never matches — a headless screen renderer has no print
 *     surface, so the evaluator recognizes only all/screen
 *   - feature queries `(feature)` and `(feature: value)`
 *   - min- and max- prefixed features, plus exact `(width: Npx)` /
 *     `(height: Npx)` matches
 *   - aspect-ratio (and min-/max-), orientation, prefers-color-scheme,
 *     prefers-reduced-motion, resolution
 *   - `and`, `or`, `not` composition (or/and as media-in-parens lists), and
 *     comma-separated media query lists (OR across queries)
 *
 *   - mq4 §2.3 range syntax: `(width >= 300px)`, `(400px < width <= 800px)`,
 *     `(600px > width)` (value-first flips the comparison), extended to
 *     aspect-ratio and resolution. `==` is tokenized but rejected — Blink's
 *     stylesheet parser accepts it only inside @container.
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

export interface MediaEnvironment {
  width: number;
  height: number;
  prefersColorScheme?: 'light' | 'dark';
  prefersReducedMotion?: 'no-preference' | 'reduce';
  dppx?: number;
  /** Device capability inputs: the caller states the device surface, the
   * engine never guesses (defaults mirror headless desktop Chrome). */
  hover?: 'hover' | 'none';
  anyHover?: 'hover' | 'none';
  pointer?: 'fine' | 'coarse' | 'none';
  anyPointer?: 'fine' | 'coarse' | 'none';
  prefersContrast?: 'no-preference' | 'more' | 'less' | 'custom';
  forcedColors?: 'active' | 'none';
  colorGamut?: 'srgb' | 'p3' | 'rec2020';
  update?: 'fast' | 'slow' | 'none';
}

export type Token = string;

/** Media-query punctuation: range operators (< > <= >= = ==) tokenize as
 * single tokens so `(width>=600px)` and `(400px < width <= 800px)` parse. */
const PUNCT = new Set(['(', ')', ':', '/', ',']);

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
    if (PUNCT.has(c)) {
      tokens.push(c);
      i++;
      continue;
    }
    if (c === '<' || c === '>') {
      if (i + 1 < n && input[i + 1] === '=') {
        tokens.push(c + '=');
        i += 2;
      } else {
        tokens.push(c);
        i++;
      }
      continue;
    }
    if (c === '=') {
      if (i + 1 < n && input[i + 1] === '=') {
        tokens.push('==');
        i += 2;
      } else {
        tokens.push('=');
        i++;
      }
      continue;
    }
    let j = i;
    while (j < n && !/[\s(),:\/<>=]/.test(input[j])) j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

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

export function hasTopLevelOperator(tokens: Token[]): boolean {
  let depth = 0;
  for (const t of tokens) {
    if (t === '(') depth++;
    else if (t === ')') depth--;
    else if ((t === 'and' || t === 'or') && depth === 0) return true;
  }
  return false;
}

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

const RANGE_OPS = new Set(['<', '>', '<=', '>=', '=']);

/** The operator the feature carries when it appears left of the op. */
const DIRECT_OPS: Record<string, MediaOp> = {
  '<': 'lt',
  '<=': 'lte',
  '>': 'gt',
  '>=': 'gte',
  '=': 'eq',
};

/** The operator when the feature appears right of the op: `400px < width`
 * means width > 400px (css-media-queries-4 §2.3 flips the comparison). */
const FLIPPED_OPS: Record<string, MediaOp> = {
  '<': 'gt',
  '<=': 'gte',
  '>': 'lt',
  '>=': 'lte',
  '=': 'eq',
};

const isFeatureName = (t: string): boolean => /^[a-z][a-z0-9-]*$/i.test(t);

function featureCond(name: string, op: MediaOp, value: string | null): MediaCondition {
  return { type: 'feature', name: name.toLowerCase(), op, value };
}

/** Ratio values tokenize as number '/' number — rejoin them so range parsing
 * sees `(aspect-ratio >= 3/4)` as three tokens. */
function joinRatios(inner: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < inner.length; i++) {
    const t = inner[i];
    if (t === '/' && /^-?[\d.]+$/.test(out[out.length - 1] ?? '') && /^-?[\d.]+$/.test(inner[i + 1] ?? '')) {
      out[out.length - 1] = `${out[out.length - 1]}/${inner[i + 1]}`;
      i++;
      continue;
    }
    out.push(t);
  }
  return out;
}

function parseFeature(innerTokens: Token[]): MediaCondition | null {
  const inner = joinRatios(innerTokens);
  const nameTok = inner[0];
  if (!nameTok || nameTok === '(' || nameTok === ')') return null;
  const name = nameTok.toLowerCase();
  // Range syntax, css-media-queries-4 §2.3: (name op value), (value op name),
  // and the two-sided (value op name op value).
  if (inner.length >= 3 && inner.length % 2 === 1 && RANGE_OPS.has(inner[1])) {
    if (inner.length === 3) {
      const [a, op, b] = inner;
      if (isFeatureName(a) && !RANGE_OPS.has(b)) {
        const v = inner.slice(2).join('');
        return featureCond(a, DIRECT_OPS[op], v);
      }
      if (isFeatureName(b)) {
        const v = a;
        return featureCond(b, FLIPPED_OPS[op], v);
      }
      return null;
    }
    // two-sided: value op name op value
    const [lo, op1, mid, op2, hi] = inner;
    if (!isFeatureName(mid)) return null;
    if (!RANGE_OPS.has(op1) || !RANGE_OPS.has(op2)) return null;
    const left = featureCond(mid, FLIPPED_OPS[op1], lo);
    const right = featureCond(mid, DIRECT_OPS[op2], hi);
    return { type: 'and', children: [left, right] };
  }
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

/** css-values-4 §5.4.1 <ratio>: <number> [ / <number> ]? — at most two numbers,
 * a zero divisor invalidates the ratio. Shared by the @media and @container
 * evaluators; the strict 3-part rejection is Blink-correct (the container
 * path's old local parse accepted `a/b/c` by ignoring the tail). */
export function parseRatio(value: string): [number, number] | null {
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

/** Compare `width/height` against ratio `a/b` via cross multiplication —
 * exact for integers, no division. Shared by the @media and @container
 * evaluators (container queries compare against the container's content box). */
export function compareAspectRatio(width: number, height: number, a: number, b: number, op: MediaOp): boolean {
  const lhs = width * b;
  const rhs = height * a;
  switch (op) {
    case 'eq':
      return lhs === rhs;
    case 'min':
      return lhs >= rhs;
    case 'max':
      return lhs <= rhs;
    case 'lt':
      return lhs < rhs;
    case 'gt':
      return lhs > rhs;
    case 'lte':
      return lhs <= rhs;
    case 'gte':
      return lhs >= rhs;
    default:
      return false;
  }
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

export function compareNum(current: number, target: number, op: MediaOp): boolean {
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
      return compareAspectRatio(env.width, env.height, r[0], r[1], op);
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
        case 'lt':
          return cur < target - eps;
        case 'gt':
          return cur > target + eps;
        case 'lte':
          return cur <= target + eps;
        case 'gte':
          return cur >= target - eps;
        default:
          return false;
      }
    }
    // Discrete device-capability features: the MediaEnvironment input is the
    // only source of truth (the caller states the device surface); only the
    // eq/flag forms are valid — Chrome rejects min-/max- and range operators
    // on discrete features, so other ops never match.
    case 'hover':
      return op === 'flag' ? (env.hover ?? 'hover') !== 'none' : op === 'eq' && value === (env.hover ?? 'hover');
    case 'any-hover':
      return op === 'flag' ? (env.anyHover ?? 'hover') !== 'none' : op === 'eq' && value === (env.anyHover ?? 'hover');
    case 'pointer':
      return op === 'flag' ? (env.pointer ?? 'fine') !== 'none' : op === 'eq' && value === (env.pointer ?? 'fine');
    case 'any-pointer':
      return op === 'flag' ? (env.anyPointer ?? 'fine') !== 'none' : op === 'eq' && value === (env.anyPointer ?? 'fine');
    case 'prefers-contrast':
      return op === 'flag'
        ? (env.prefersContrast ?? 'no-preference') !== 'no-preference'
        : op === 'eq' && value === (env.prefersContrast ?? 'no-preference');
    case 'forced-colors':
      return op === 'flag' ? (env.forcedColors ?? 'none') === 'active' : op === 'eq' && value === (env.forcedColors ?? 'none');
    case 'color-gamut':
      // Boolean context: every renderer has at least srgb (mq4 §8.14).
      return op === 'flag' ? true : op === 'eq' && value === (env.colorGamut ?? 'srgb');
    case 'update':
      return op === 'flag' ? (env.update ?? 'fast') !== 'none' : op === 'eq' && value === (env.update ?? 'fast');
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

export function evaluateMediaQueryList(queries: MediaQuery[], env: MediaEnvironment): boolean {
  return queries.some((q) => evaluateCondition(q.condition, env));
}
