/**
 * CSS value-function resolution for calc()/min()/max()/clamp() (css-values-4
 * §10-11), mirroring Blink's cs_math_expression: every valid expression
 * simplifies to a linear combination of the units the engine already resolves
 * (px, %, vw, vh, vmin, vmax, em), because multiplication only ever scales by a
 * dimensionless number and division only divides by one — so min/max/clamp are
 * the only non-linear nodes and they compare plain numbers at used-value time.
 *
 * The parser mirrors Blink's acceptance rules so invalid forms reject wholesale
 * (the caller falls back to auto, exactly like a dropped declaration):
 *   - `+`/`-` require whitespace on both sides (css-values-4 §11.2); a sign
 *     glued to a following number is part of that number token instead.
 *   - a multiplication where both operands are dimensioned, and a division
 *     whose divisor is dimensioned, are rejected (they would produce a unit
 *     type the property cannot consume). A pure-number result is likewise
 *     rejected as a length (Chrome drops the declaration).
 *   - a pure number never mixes with a dimensioned value in +, -, min/max/clamp
 *     arguments (Chrome rejects the declaration).
 */

export interface Affine {
  px: number;
  pct: number;
  vw: number;
  vh: number;
  vmin: number;
  vmax: number;
  em: number;
}

export type MathExpr =
  | { t: 'aff'; a: Affine; pure: boolean }
  | { t: 'min'; args: MathExpr[]; pure: boolean }
  | { t: 'max'; args: MathExpr[]; pure: boolean }
  | { t: 'clamp'; mn: MathExpr; val: MathExpr; mx: MathExpr; pure: boolean };

export const ZERO_AFFINE: Affine = { px: 0, pct: 0, vw: 0, vh: 0, vmin: 0, vmax: 0, em: 0 };

const FUNCTIONS = new Set(['calc', 'min', 'max', 'clamp']);

/** Root-relative px factor for rem (the engine's root font-size constant,
 * matching Chrome's 16px default when no root font-size is authored). */
const REM_PX = 16;

const UNIT_TO_KEY: Record<string, keyof Affine> = {
  px: 'px',
  '%': 'pct',
  vw: 'vw',
  vh: 'vh',
  vmin: 'vmin',
  vmax: 'vmax',
  em: 'em',
};

export function resolveMathExpr(e: MathExpr, ref: number, viewport?: { width: number; height: number } | null): number | null {
  switch (e.t) {
    case 'aff': {
      const a = e.a;
      // em must have been folded into px by resolveEmLength before resolution;
      // an un-folded em cannot resolve here (no font-size context).
      if (a.em !== 0) return null;
      if (viewport) {
        const vw = viewport.width / 100;
        const vh = viewport.height / 100;
        return a.px + (a.pct / 100) * ref + a.vw * vw + a.vh * vh + a.vmin * Math.min(vw, vh) + a.vmax * Math.max(vw, vh);
      }
      if (a.vw !== 0 || a.vh !== 0 || a.vmin !== 0 || a.vmax !== 0) return null;
      return a.px + (a.pct / 100) * ref;
    }
    case 'min':
    case 'max': {
      let acc: number | null = null;
      for (const arg of e.args) {
        const v = resolveMathExpr(arg, ref, viewport);
        if (v === null) return null;
        acc = acc === null ? v : e.t === 'min' ? Math.min(acc, v) : Math.max(acc, v);
      }
      return acc;
    }
    case 'clamp': {
      const mn = resolveMathExpr(e.mn, ref, viewport);
      const val = resolveMathExpr(e.val, ref, viewport);
      const mx = resolveMathExpr(e.mx, ref, viewport);
      if (mn === null || val === null || mx === null) return null;
      return Math.max(mn, Math.min(val, mx));
    }
  }
}

/** Substitute each em coefficient for the element's font-size, producing a
 * px-only affine (used-value em, css-values-4 §5.2). */
export function foldEmExpr(e: MathExpr, fontSize: number): MathExpr {
  switch (e.t) {
    case 'aff':
      if (e.a.em === 0) return e;
      return {
        t: 'aff',
        a: { ...e.a, px: e.a.px + e.a.em * fontSize, em: 0 },
        pure: e.pure,
      };
    case 'min':
      return { t: 'min', args: e.args.map((a) => foldEmExpr(a, fontSize)), pure: e.pure };
    case 'max':
      return { t: 'max', args: e.args.map((a) => foldEmExpr(a, fontSize)), pure: e.pure };
    case 'clamp':
      return {
        t: 'clamp',
        mn: foldEmExpr(e.mn, fontSize),
        val: foldEmExpr(e.val, fontSize),
        mx: foldEmExpr(e.mx, fontSize),
        pure: e.pure,
      };
  }
}

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isSpace = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);

export function parseMathValue(raw: string): MathExpr | null {
  const src = raw.trim();
  let pos = 0;
  const len = src.length;

  const skipWs = (): boolean => {
    const start = pos;
    while (pos < len && isSpace(src[pos])) pos++;
    return pos > start;
  };

  // unit is null for a bare number (dimensionless); 'rem' resolves against the
  // engine's root font-size constant; otherwise a length/percentage unit key.
  const parseNumber = (): { v: number; unit: keyof Affine | 'rem' | null } | null => {
    let sign = 1;
    if (src[pos] === '+' || src[pos] === '-') {
      // Sign is part of the number token only when glued to a following digit.
      if (isDigit(src[pos + 1])) {
        sign = src[pos] === '-' ? -1 : 1;
        pos++;
      } else {
        return null;
      }
    }
    if (!isDigit(src[pos]) && src[pos] !== '.') return null;
    const digitsStart = pos;
    while (pos < len && isDigit(src[pos])) pos++;
    if (src[pos] === '.') {
      pos++;
      while (pos < len && isDigit(src[pos])) pos++;
    }
    if ((src[pos] === 'e' || src[pos] === 'E') && (isDigit(src[pos + 1]) || src[pos + 1] === '+' || src[pos + 1] === '-')) {
      pos++;
      if (src[pos] === '+' || src[pos] === '-') pos++;
      if (!isDigit(src[pos])) return null;
      while (pos < len && isDigit(src[pos])) pos++;
    }
    const value = sign * parseFloat(src.slice(digitsStart, pos));
    // Unit letters (% or [a-z]+) directly after the number.
    if (src[pos] === '%') {
      pos++;
      return { v: value, unit: 'pct' };
    }
    let unitStr = '';
    while (pos < len && /[a-z]/.test(src[pos])) {
      unitStr += src[pos];
      pos++;
    }
    if (unitStr === '') return { v: value, unit: null };
    if (unitStr === 'rem') return { v: value, unit: 'rem' };
    const key = UNIT_TO_KEY[unitStr];
    if (key === undefined) return null;
    return { v: value, unit: key };
  };

  const aff = (v: number, unit: keyof Affine | 'rem' | null): MathExpr => {
    const a: Affine = { ...ZERO_AFFINE };
    if (unit === 'rem') {
      a.px = v * REM_PX;
      return { t: 'aff', a, pure: false };
    }
    if (unit === null) {
      a.px = v;
      return { t: 'aff', a, pure: true };
    }
    a[unit] = v;
    return { t: 'aff', a, pure: false };
  };

  const parseFactor = (): MathExpr | null => {
    skipWs();
    const c = src[pos];
    if (c === '(') {
      pos++;
      const inner = parseSum();
      if (!inner) return null;
      skipWs();
      if (src[pos] !== ')') return null;
      pos++;
      return inner;
    }
    if (isDigit(c) || c === '.' || ((c === '+' || c === '-') && (isDigit(src[pos + 1]) || src[pos + 1] === '.'))) {
      const n = parseNumber();
      if (!n) return null;
      return aff(n.v, n.unit);
    }
    if (c !== undefined && /[a-zA-Z]/.test(c)) {
      let name = '';
      while (pos < len && /[a-zA-Z]/.test(src[pos])) {
        name += src[pos].toLowerCase();
        pos++;
      }
      if (src[pos] !== '(' || !FUNCTIONS.has(name)) return null;
      pos++;
      const args: MathExpr[] = [];
      for (;;) {
        skipWs();
        const arg = parseSum();
        if (!arg) return null;
        args.push(arg);
        skipWs();
        if (src[pos] === ',') {
          pos++;
          continue;
        }
        break;
      }
      if (src[pos] !== ')') return null;
      pos++;
      if (name === 'calc') {
        if (args.length !== 1) return null;
        return args[0];
      }
      const purity = args.map((a) => a.pure);
      if (purity.some((p) => p !== purity[0])) return null;
      const pure = purity[0];
      if (name === 'min') return { t: 'min', args, pure };
      if (name === 'max') return { t: 'max', args, pure };
      if (name === 'clamp') {
        if (args.length !== 3) return null;
        return { t: 'clamp', mn: args[0], val: args[1], mx: args[2], pure };
      }
      return null;
    }
    return null;
  };

  const affAdd = (ca: Affine, sign: number, cb: Affine): Affine => ({
    px: ca.px + sign * cb.px,
    pct: ca.pct + sign * cb.pct,
    vw: ca.vw + sign * cb.vw,
    vh: ca.vh + sign * cb.vh,
    vmin: ca.vmin + sign * cb.vmin,
    vmax: ca.vmax + sign * cb.vmax,
    em: ca.em + sign * cb.em,
  });

  const affScale = (a: Affine, k: number): Affine => ({
    px: a.px * k,
    pct: a.pct * k,
    vw: a.vw * k,
    vh: a.vh * k,
    vmin: a.vmin * k,
    vmax: a.vmax * k,
    em: a.em * k,
  });

  // Map a unary function over a compound node's arguments, rejecting when an
  // argument is itself non-affine (nested min/max can only be combined through
  // additive distribution, which the recursion below already handles).
  const mapArgs = (e: MathExpr, fn: (arg: MathExpr) => MathExpr | null): MathExpr | null => {
    if (e.t === 'min' || e.t === 'max') {
      const args: MathExpr[] = [];
      for (const arg of e.args) {
        const mapped = fn(arg);
        if (!mapped) return null;
        args.push(mapped);
      }
      return { t: e.t, args, pure: e.pure };
    }
    if (e.t === 'clamp') {
      const mn = fn(e.mn);
      const val = fn(e.val);
      const mx = fn(e.mx);
      if (!mn || !val || !mx) return null;
      return { t: 'clamp', mn, val, mx, pure: e.pure };
    }
    return fn(e);
  };

  // Blink cs_math_expression: additive combination distributes into min/max
  // arguments (min(a,b) + c = min(a+c, b+c)), but multiplication of a non-linear
  // expression is rejected (only division by a number distributes).
  const combine = (a: MathExpr, op: string, b: MathExpr): MathExpr | null => {
    if (op === '+' || op === '-') {
      if (a.pure !== b.pure) return null;
      const sign = op === '+' ? 1 : -1;
      if (a.t === 'aff' && b.t === 'aff') {
        return { t: 'aff', a: affAdd(a.a, sign, b.a), pure: a.pure };
      }
      if (a.t === 'aff' && b.t !== 'aff') {
        const rhs = mapArgs(b, (arg) => {
          if (arg.pure !== a.pure) return null;
          if (arg.t !== 'aff') return null;
          return { t: 'aff', a: affAdd(a.a, 1, arg.a), pure: a.pure };
        });
        return rhs;
      }
      if (b.t === 'aff' && a.t !== 'aff') {
        return mapArgs(a, (arg) => {
          if (arg.pure !== b.pure) return null;
          if (arg.t !== 'aff') return null;
          return { t: 'aff', a: affAdd(arg.a, sign, b.a), pure: b.pure };
        });
      }
      // min/max + min/max has no affine fold; Blink rejects it.
      return null;
    }
    if (op === '*') {
      // Reject when either side is a non-linear expression (Chrome drops the
      // declaration); multiplication is otherwise scaling by a pure number.
      if (a.t !== 'aff' || b.t !== 'aff') return null;
      if (!a.pure && !b.pure) return null;
      const scale = a.pure ? a.a.px : b.a.px;
      const other = a.pure ? b.a : a.a;
      return { t: 'aff', a: affScale(other, scale), pure: a.pure && b.pure };
    }
    // '/'
    if (!b.pure || b.t !== 'aff' || b.a.px === 0) return null;
    return mapArgs(a, (arg) => {
      if (arg.t !== 'aff') return null;
      return { t: 'aff', a: affScale(arg.a, 1 / b.a.px), pure: arg.pure };
    });
  };

  const parseProduct = (): MathExpr | null => {
    let left = parseFactor();
    if (!left) return null;
    for (;;) {
      // `*`/`/` need no surrounding whitespace, but may have it; rewind the
      // skipped whitespace when the next token is not an operator so the sum
      // level can still see it for its + / - whitespace rule.
      const mark = pos;
      skipWs();
      const c = src[pos];
      if (c !== '*' && c !== '/') {
        pos = mark;
        return left;
      }
      pos++;
      const right = parseFactor();
      if (!right) return null;
      const merged = combine(left, c, right);
      if (!merged) return null;
      left = merged;
    }
  };

  const parseSum = (): MathExpr | null => {
    let left = parseProduct();
    if (!left) return null;
    for (;;) {
      const hadWs = skipWs();
      const c = src[pos];
      if (c !== '+' && c !== '-') return left;
      // A sign glued to a following digit is a fresh operand, not an operator
      // (css-values-4: + and - must be separated by whitespace).
      if (isDigit(src[pos + 1]) || src[pos + 1] === '.') return null;
      if (!hadWs) return null;
      pos++;
      skipWs();
      const right = parseProduct();
      if (!right) return null;
      const merged = combine(left, c, right);
      if (!merged) return null;
      left = merged;
    }
  };

  const expr = parseSum();
  if (!expr) return null;
  skipWs();
  if (pos < len) return null;
  return expr;
}
