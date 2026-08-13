/**
 * Media-query cascade phase (owning module for this task).
 *
 * Evaluates `@media` rules against the viewport input and gates rule
 * application, then resolves the matched rules' declarations per element in
 * cascade order (specificity, then source order). The viewport input — width,
 * height, prefers-color-scheme, prefers-reduced-motion, dppx — is the only
 * media surface: nothing here touches a live browser.
 *
 * `@container`: this task establishes the *evaluation model* (a parsed
 * container condition can be evaluated against a container's content-box
 * size), but the layout plumbing that computes container-type/container-name
 * containers does not exist yet — container sizing is provided by layout in a
 * later task. Until then the phase parses @container rules but never applies
 * them; the gap is documented in docs/ledgers/media-queries.md and proven by
 * the corpus fixtures `container-inert` and `container-gap`.
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

export interface ContainerSize {
  /** container content-box width (px). */
  width: number;
  /** container content-box height (px). */
  height: number;
}

/**
 * Evaluate a container condition against a container's size — the @container
 * evaluation model. `condition` is the parsed `@container` condition; features
 * are width/height comparisons (min/max/exact/range) and aspect-ratio.
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

/** An @media group (one enclosing @media's query list) matches when any query does. */
function mediaGroupsActive(groups: MediaQuery[][], env: MediaEnvironment): boolean {
  return groups.every((g) => evaluateMediaQueryList(g, env));
}

/**
 * Resolve the stylesheet cascade for the body subtree: for every element, the
 * declarations of the matching rules that are active in this media environment,
 * in ascending cascade order (weakest specificity/source first). Inline style
 * attributes are layered above by the caller.
 *
 * @container rules parse but never apply (no container sizing from layout yet);
 * they are excluded here by construction, which is the documented gap.
 */
export function resolveMediaCascade(
  root: P5Element,
  styleElements: P5Element[],
  env: MediaEnvironment,
): Map<P5Element, Declaration[]> {
  const rules: CascadeRule[] = [];
  for (const el of styleElements) {
    const css = styleText(el);
    if (!css) continue;
    for (const rule of parseStylesheet(css).rules) {
      // @container rules parse but never apply: container sizing comes from
      // layout, which this task doesn't have yet (documented gap — see
      // docs/ledgers/media-queries.md). Excluding them here keeps the engine
      // from silently applying a query it cannot resolve.
      if (rule.containerGroups.length > 0) continue;
      if (!mediaGroupsActive(rule.mediaGroups, env)) continue;
      rules.push(rule);
    }
  }

  const map = new Map<P5Element, Declaration[]>();
  const walk = (el: P5Element): void => {
    const matched: { spec: Specificity; order: number; decls: Declaration[] }[] = [];
    for (const rule of rules) {
      let best: Specificity | null = null;
      for (const s of rule.selectors) {
        const sel: ComplexSelector | null = parseSelector(s);
        if (sel && matchesComplex(sel, el)) {
          const sp = specificity(sel);
          if (best === null || compareSpecificity(sp, best) > 0) best = sp;
        }
      }
      if (best !== null) matched.push({ spec: best, order: rule.order, decls: rule.declarations });
    }
    matched.sort((x, y) => compareSpecificity(x.spec, y.spec) || x.order - y.order);
    if (matched.length > 0) map.set(el, matched.flatMap((m) => m.decls));

    for (const child of el.childNodes) {
      if (child.nodeName === '#text' || child.nodeName === '#comment') continue;
      const name = (child as P5Element).nodeName;
      if (name === 'style' || name === 'script' || name === 'head' || name === 'title') continue;
      walk(child as P5Element);
    }
  };
  walk(root);
  return map;
}

function styleText(el: P5Element): string | null {
  const text = el.childNodes.find((n) => n.nodeName === '#text');
  return text ? (text as { value: string }).value : null;
}
