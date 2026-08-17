/**
 * Media-query cascade phase (owning module for this task).
 *
 * Evaluates `@media` rules against the viewport input and gates rule
 * application, then resolves the matched rules' declarations per element in
 * cascade order (specificity, then source order). The viewport input — width,
 * height, prefers-color-scheme, prefers-reduced-motion, dppx — is the only
 * media surface: nothing here touches a live browser.
 *
 * `@container`: layout provides each inline-size container's content-box size,
 * and this phase resolves each rule's nearest qualifying ancestor container
 * (by name, when named) and evaluates the condition against that size. Only
 * `container-type: inline-size` establishes a container in v1; `size`/
 * `block-size` parse but establish none (documented in docs/ledgers/media-queries.md).
 */

import type { P5Element } from '../../layout/types.js';
import type { Declaration } from '../../layout/css.js';
import { parseStylesheet, parseContainerPrelude, type CascadeRule, type ContainerGroup } from '../stylesheet.js';
import {
  evaluateMediaQueryList,
  type MediaCondition,
  type MediaEnvironment,
  type MediaQuery,
  type MediaOp,
} from '../media.js';
import { parseSelector, matchesComplex, specificity, compareSpecificity, type ComplexSelector, type Specificity } from '../selector.js';

export type { ContainerGroup };
export { parseContainerPrelude, parseContainerCondition } from '../stylesheet.js';
export type { MediaCondition, MediaEnvironment } from '../media.js';

/** True when any stylesheet declares an @container rule — the signal that layout
 * must resolve container sizes for the cascade. */
export function hasContainerRules(styleElements: P5Element[]): boolean {
  for (const el of styleElements) {
    const css = styleText(el);
    if (!css) continue;
    for (const rule of parseStylesheet(css).rules) {
      if (rule.containerGroups.length > 0) return true;
    }
  }
  return false;
}

export interface ContainerSize {
  width: number;
  height: number;
}

/** Container data for one element, supplied by layout: the content-box size and
 * the element's container-name (css-contain-3 §3.2). Only elements that
 * establish a container (container-type: inline-size in v1) appear as keys. */
export interface ContainerData extends ContainerSize {
  name: string[];
}

/** element → container data; `undefined` means @container rules cannot be
 * resolved (no layout available) and are left unapplied. */
export type ContainerMap = Map<P5Element, ContainerData>;

export interface PseudoDecls {
  before: Declaration[];
  after: Declaration[];
}

export interface CascadeResult {
  element: Map<P5Element, Declaration[]>;
  pseudo: Map<P5Element, PseudoDecls>;
}

/**
 * Container-name resolution and container-size discovery come from layout and
 * are not available yet (see the ledger).
 */
export function evaluateContainerCondition(condition: MediaCondition, container: ContainerSize): boolean {
  switch (condition.type) {
    case 'and':
      return condition.children.every((c) => evaluateContainerCondition(c, container));
    case 'or':
      return condition.children.some((c) => evaluateContainerCondition(c, container));
    case 'not':
      return !evaluateContainerCondition(condition.child, container);
    case 'feature':
      return evaluateContainerFeature(condition, container);
    case 'type':
      return false;
  }
}

function evaluateContainerFeature(
  cond: { name: string; op: MediaOp; value: string | null },
  container: ContainerSize,
): boolean {
  const value = cond.value !== null ? parseFloat(cond.value) : NaN;
  if (!Number.isFinite(value)) return false;
  switch (cond.name) {
    case 'width':
      return compare(container.width, value, cond.op);
    case 'height':
      return compare(container.height, value, cond.op);
    case 'aspect-ratio': {
      const parts = cond.value!.split('/');
      const a = parseFloat(parts[0]);
      const b = parts.length > 1 ? parseFloat(parts[1]) : 1;
      if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return false;
      const lhs = container.width * b;
      const rhs = container.height * a;
      switch (cond.op) {
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
    default:
      return false;
  }
}

function compare(current: number, target: number, op: MediaOp): boolean {
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

function mediaGroupsActive(groups: MediaQuery[][], env: MediaEnvironment): boolean {
  return groups.every((g) => evaluateMediaQueryList(g, env));
}

/** The nearest ancestor of `el` that establishes a query container matching the
 * group's name. An unnamed query selects the nearest container regardless of
 * name; a named query skips non-matching containers and keeps walking up
 * (css-contain-3 §3.1 container selection). Returns null when layout supplies no
 * container for that ancestor (it does not establish one in v1). */
function queryContainerFor(el: P5Element, name: string | null, containers: ContainerMap): ContainerData | null {
  let cur = el.parentNode as unknown;
  while (cur && isElementLike(cur)) {
    const data = containers.get(cur as P5Element);
    if (data !== undefined && (name === null || data.name.includes(name))) return data;
    cur = (cur as P5Element).parentNode as unknown;
  }
  return null;
}

function isElementLike(n: unknown): boolean {
  return typeof n === 'object' && n !== null && (n as { nodeName?: string }).nodeName !== undefined;
}

/** True when every enclosing @container group resolves a matching container and
 * its condition holds against that container's content-box size. With no layout
 * container map (@container unresolved), a rule nested in any @container group
 * is inactive. */
function containerGroupsActive(
  groups: ContainerGroup[],
  el: P5Element,
  containers: ContainerMap | undefined,
): boolean {
  if (groups.length === 0) return true;
  if (!containers) return false;
  return groups.every((g) => {
    const container = queryContainerFor(el, g.name, containers);
    if (!container) return false;
    if (!g.condition) return true;
    return evaluateContainerCondition(g.condition.condition, container);
  });
}

/**
 * Resolve the stylesheet cascade for the body subtree: for every element, the
 * declarations of the matching rules that are active in this media environment,
 * in ascending cascade order (weakest specificity/source first). Inline style
 * attributes are layered above by the caller.
 *
 * Rules whose selector carries a ::before/::after pseudo-element match the
 * originating element and their declarations are collected separately (per
 * pseudo), never applied to the element itself.
 *
 * @container rules apply only when `containers` (layout-provided container
 * sizes) is supplied; otherwise they parse but never apply — the documented
 * pre-layout state.
 */
export function resolveMediaCascade(
  root: P5Element,
  styleElements: P5Element[],
  env: MediaEnvironment,
  containers?: ContainerMap,
): CascadeResult {
  const rules: CascadeRule[] = [];
  for (const el of styleElements) {
    const css = styleText(el);
    if (!css) continue;
    for (const rule of parseStylesheet(css).rules) {
      if (!mediaGroupsActive(rule.mediaGroups, env)) continue;
      rules.push(rule);
    }
  }

  const element = new Map<P5Element, Declaration[]>();
  const pseudo = new Map<P5Element, PseudoDecls>();
  const walk = (el: P5Element): void => {
    // Each selector in a rule targets the element or one of its pseudos; a rule
    // may target several at once (`.a, .a::after`), so track the best
    // specificity per target and record the rule against every target it matches.
    const matched: { spec: Specificity; order: number; decls: Declaration[]; target: 'element' | 'before' | 'after' }[] = [];
    for (const rule of rules) {
      // A rule inside a false @container group is inert for this element; a
      // rule with no container groups is always considered.
      if (!containerGroupsActive(rule.containerGroups, el, containers)) continue;
      let elementBest: Specificity | null = null;
      let beforeBest: Specificity | null = null;
      let afterBest: Specificity | null = null;
      for (const s of rule.selectors) {
        const sel: ComplexSelector | null = parseSelector(s);
        if (sel && matchesComplex(sel, el)) {
          const sp = specificity(sel);
          const target = sel.parts[sel.parts.length - 1].compound.pseudo ?? 'element';
          const slot = target === 'before' ? beforeBest : target === 'after' ? afterBest : elementBest;
          if (slot === null || compareSpecificity(sp, slot) > 0) {
            if (target === 'before') beforeBest = sp;
            else if (target === 'after') afterBest = sp;
            else elementBest = sp;
          }
        }
      }
      if (elementBest !== null) matched.push({ spec: elementBest, order: rule.order, decls: rule.declarations, target: 'element' });
      if (beforeBest !== null) matched.push({ spec: beforeBest, order: rule.order, decls: rule.declarations, target: 'before' });
      if (afterBest !== null) matched.push({ spec: afterBest, order: rule.order, decls: rule.declarations, target: 'after' });
    }
    matched.sort((x, y) => compareSpecificity(x.spec, y.spec) || x.order - y.order);
    if (matched.length > 0) {
      const elementDecls: Declaration[] = [];
      const pseudoDecls: PseudoDecls = { before: [], after: [] };
      for (const m of matched) {
        if (m.target === 'before') pseudoDecls.before.push(...m.decls);
        else if (m.target === 'after') pseudoDecls.after.push(...m.decls);
        else elementDecls.push(...m.decls);
      }
      if (elementDecls.length > 0) element.set(el, elementDecls);
      if (pseudoDecls.before.length > 0 || pseudoDecls.after.length > 0) pseudo.set(el, pseudoDecls);
    }

    for (const child of el.childNodes) {
      if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
      const name = (child as P5Element).nodeName;
      if (name === 'style' || name === 'script' || name === 'head' || name === 'title') continue;
      walk(child as P5Element);
    }
  };
  walk(root);
  return { element, pseudo };
}

function styleText(el: P5Element): string | null {
  const text = el.childNodes.find((n) => n.nodeName === '#text');
  return text ? (text as { value: string }).value : null;
}
