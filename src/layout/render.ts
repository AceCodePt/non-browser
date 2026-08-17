/**
 * Top-level render path: parse5 HTML → inline-style cascade → block text layout
 * → paint → PNG pixel buffer. The viewport is an input, the output is an RGBA
 * pixel buffer plus per-id border-box rects and (optionally) computed-style
 * strings for the layer-2 oracle.
 *
 * All measurement and paint go through the generic Canvas interface; the skia
 * implementation is the default factory, and Pretext's measurement is wired to
 * the same interface so the fonts a fixture is measured with are the fonts that
 * get drawn.
 *
 * The dependency chain is strict — parse → cascade → measure → layout → paint —
 * so the entry functions below stop the pipeline at the stage their answer
 * needs: `renderHtml` runs everything, `rectsOf` stops after layout (no canvas,
 * no PNG), `computedStylesOf` stops after the cascade (no layout at all, unless
 * the document uses `@container`, whose sizes only layout can provide). All
 * three share the `prepare` core so a selective answer is guaranteed to be the
 * full path cut short, never a separate computation.
 */

import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { CanvasFactory, CanvasLike } from '../canvas/interface.js';
import { skiaCanvasFactory } from '../canvas/skia.js';
import { installPretextMeasurement } from '../pretext/index.js';
import { resolveMediaCascade, hasContainerRules, type ContainerMap, type MediaEnvironment } from '../cascade/index.js';
import { resolveStyles, layoutRoot, type RootLayout, type StyleDefaults, type LayoutNode } from './block-inline.js';
import { computedStyleFor, type ComputedStyleProps } from './computed-style.js';
import { paint, type RenderOutput } from './paint.js';
import { initMeasurement } from './measure.js';
import { fontVerticalMetrics, setActiveFontMetrics } from './fontmetrics.js';
import type { ComputedStyle, Viewport } from './css.js';
import type { P5Element } from './types.js';
import type { Box } from './types.js';
import { setActiveBrowserConfig, type BrowserConfig } from '../config/browser-config.js';

export interface ComputedStyleSpec {
  id: string;
  pseudo?: 'before' | 'after';
  props: string[];
}

export interface MediaInput {
  prefersColorScheme?: 'light' | 'dark';
  prefersReducedMotion?: 'no-preference' | 'reduce';
  dppx?: number;
}

export interface RenderOptions {
  width: number;
  height: number;
  fontFamily: string;
  /** Path to the TTF that both the engine and the Chrome oracle resolve to. */
  fontFile: string;
  /**
   * Per-browser config (fallback table + font-registration set). When set, its
   * font set is registered instead of the single `fontFile`, and CSS font
   * stacks resolve through its fallback table (charter §4). Defaults to a
   * chrome config built from `fontFamily`/`fontFile`.
   */
  browserConfig?: BrowserConfig;
  fontSize?: number;
  lineHeight?: number;
  canvasFactory?: CanvasFactory;
  computedStyle?: ComputedStyleSpec[];
  textElements?: string[];
  media?: MediaInput;
}

export interface RenderHtmlOutput extends RenderOutput {
  computedStyles: Record<string, ComputedStyleProps>;
}

/** Layer-3 answer: the border-box rects of every id-bearing element. */
export interface RectsOutput {
  width: number;
  height: number;
  rects: Record<string, Box>;
}

/** Layer-2 answer: computed-style strings for the requested specs. */
export interface ComputedStylesOutput {
  width: number;
  height: number;
  computedStyles: Record<string, ComputedStyleProps>;
}

interface Prepared {
  body: P5Element;
  styles: Map<P5Element, ComputedStyle>;
  viewport: Viewport;
  config: BrowserConfig;
  factory: CanvasFactory;
  /** ids of every id-bearing element in the body, for rect completeness asserts. */
  ids: string[];
  styleElements: P5Element[];
  mediaEnv: MediaEnvironment;
  styleDefaults: StyleDefaults;
  /** whether any stylesheet declares @container rules (layout must resolve them). */
  usesContainers: boolean;
}

/**
 * Shared pipeline core behind every entry function: parse, browser-config /
 * font registration, measurement init, media cascade, resolveStyles. None of
 * the later stages (layout/paint) exist here, which is what lets the selective
 * entry functions stop before paying for them.
 */
function prepare(html: string, opts: RenderOptions, label: string): Prepared {
  const doc = parse(html);
  const htmlEl = (doc as unknown as { childNodes: DefaultTreeAdapterTypes.ChildNode[] }).childNodes.find(
    (n) => n.nodeName === 'html',
  ) as P5Element;
  const body = htmlEl?.childNodes.find((n) => n.nodeName === 'body') as P5Element;
  if (!body) throw new Error(`${label}: no <body> element in input`);

  const factory = opts.canvasFactory ?? skiaCanvasFactory;
  const config: BrowserConfig = opts.browserConfig ?? {
    browser: 'chrome',
    fonts: [{ family: opts.fontFamily, filePath: opts.fontFile }],
    fallback: {},
    defaultFamily: opts.fontFamily,
    defaultFile: opts.fontFile,
  };
  setActiveBrowserConfig(config);
  for (const f of config.fonts) factory.registerFont(f.filePath);
  setActiveFontMetrics(fontVerticalMetrics(config.defaultFile));
  const measureCanvas: CanvasLike = initMeasurement(
    { family: config.defaultFamily, filePath: config.defaultFile },
    factory,
  );
  installPretextMeasurement(measureCanvas);

  const viewport: Viewport = { width: opts.width, height: opts.height };
  const mediaEnv: MediaEnvironment = {
    width: opts.width,
    height: opts.height,
    prefersColorScheme: opts.media?.prefersColorScheme,
    prefersReducedMotion: opts.media?.prefersReducedMotion,
    dppx: opts.media?.dppx,
  };
  const styleElements: P5Element[] = [];
  collectStyleElements(doc, styleElements);
  const usesContainers = hasContainerRules(styleElements);
  const cascade = resolveMediaCascade(body, styleElements, mediaEnv);

  const styleDefaults: StyleDefaults = {
    fontFamily: opts.fontFamily,
    fontSize: opts.fontSize ?? 16,
    lineHeight: opts.lineHeight ?? 'normal',
    color: { r: 0, g: 0, b: 0, a: 1 },
    letterSpacing: 0,
    textDecorationLines: [],
    textDecorationColor: null,
    textDecorationThickness: 'auto',
    textUnderlineOffset: 0,
  };
  const styles = resolveStyles(
    body,
    styleDefaults,
    cascade.element,
    cascade.pseudo,
  );

  return { body, styles, viewport, config, factory, ids: Object.keys(collectIds(body)), styleElements, mediaEnv, styleDefaults, usesContainers };
}

function assertIdsHaveRects(ids: string[], rects: Record<string, Box>): void {
  const missing: string[] = [];
  for (const id of ids) if (!rects[id]) missing.push(id);
  if (missing.length > 0) {
    throw new Error(`layout: no rect collected for id(s): ${missing.join(', ')}`);
  }
}

/** Give every DOM-present id a rect so the map is total: laid-out ids keep
 * their true border box, and ids inside display:none subtrees or on void /
 * non-layout elements (script, style) fall back to an all-zero rect — matching
 * Blink, where getBoundingClientRect on an unrendered box returns zeros (the
 * paint.ts contract "every element with an id" requires presence for all ids). */
function backfillZeroRects(ids: string[], rects: Record<string, Box>): void {
  for (const id of ids) if (!rects[id]) rects[id] = { x: 0, y: 0, width: 0, height: 0 };
}

/** Layout runs the cascade then computes container sizes; re-resolving the
 * cascade against those sizes can change container sizes again (an @container
 * rule may itself set a container's width). Iterate to a fixed point so the
 * reported styles/layout reflect the converged container set — matching Chrome's
 * layout/cascade reflow loop. Containers whose content-box size stops changing
 * are the convergence signal. */
const MAX_CONTAINER_ITERS = 8;

function containerMapsEqual(a: ContainerMap, b: ContainerMap): boolean {
  if (a.size !== b.size) return false;
  for (const [el, da] of a) {
    const db = b.get(el);
    if (!db || db.width !== da.width || db.height !== da.height) return false;
  }
  return true;
}

/** Only inline-size containers are queryable in v1, so size/block-size elements
 * are skipped here; the collected content-box size feeds evaluateContainerCondition. */
function collectContainerSizes(root: RootLayout): ContainerMap {
  const map: ContainerMap = new Map();
  const walk = (node: LayoutNode): void => {
    if (node.style.containerType === 'inline-size' && node.element) {
      map.set(node.element, {
        width: node.contentWidth,
        height: node.contentHeight,
        name: node.style.containerName,
      });
    }
    for (const c of node.children) walk(c);
  };
  walk(root.root);
  return map;
}

/** The fixed-point iteration body: re-run the cascade with @container rules
 * resolved against the current container sizes, then re-resolve styles. */
function resolveStylesWithContainers(
  prep: Prepared,
  containers: ContainerMap,
): Map<P5Element, ComputedStyle> {
  const cascade = resolveMediaCascade(prep.body, prep.styleElements, prep.mediaEnv, containers);
  return resolveStyles(prep.body, prep.styleDefaults, cascade.element, cascade.pseudo);
}

/** The container-aware cascade/layout fixed point shared by renderHtml and
 * rectsOf: returns the converged styles and layout root. Documents without
 * @container rules skip the iteration and use the single-pass styles directly. */
function convergeLayout(prep: Prepared): { styles: Map<P5Element, ComputedStyle>; root: RootLayout } {
  let styles: Map<P5Element, ComputedStyle>;
  let root: RootLayout;
  if (!prep.usesContainers) {
    styles = prep.styles;
    root = layoutRoot(prep.body, prep.styles, prep.viewport);
  } else {
    styles = prep.styles;
    root = layoutRoot(prep.body, prep.styles, prep.viewport);
    let containers = collectContainerSizes(root);
    for (let i = 0; i < MAX_CONTAINER_ITERS; i++) {
      const nextStyles = resolveStylesWithContainers(prep, containers);
      const nextRoot = layoutRoot(prep.body, nextStyles, prep.viewport);
      const nextContainers = collectContainerSizes(nextRoot);
      styles = nextStyles;
      root = nextRoot;
      if (containerMapsEqual(containers, nextContainers)) break;
      containers = nextContainers;
    }
  }
  // Totalize the rect map once on the shared converge path so both renderHtml
  // and rectsOf see every id (Blink parity for unrendered boxes).
  backfillZeroRects(prep.ids, root.rects);
  return { styles, root };
}

/** The computed-style layer's styles: layout-free unless the document uses
 * @container, whose sizes only layout can provide (a bare getComputedStyle
 * still reflects container queries, so a container doc must pay for layout). */
function resolveComputedStyles(prep: Prepared): Map<P5Element, ComputedStyle> {
  return prep.usesContainers ? convergeLayout(prep).styles : prep.styles;
}

/**
 * The layer-2 oracle block: computedStyleFor(from style, requested props) for
 * each spec, keyed by id (or `${id}::${pseudo}`) exactly as renderHtml reports
 * them. Shared by renderHtml and computedStylesOf so both answer identically.
 */
function collectComputedStyles(
  opts: RenderOptions,
  body: P5Element,
  styles: Map<P5Element, ComputedStyle>,
  viewport: Viewport,
  refWidth: number,
  label: string,
): Record<string, ComputedStyleProps> {
  const computedStyles: Record<string, ComputedStyleProps> = {};
  if (!opts.computedStyle) return computedStyles;
  const byId = new Map<string, P5Element>();
  collectByElementId(body, byId);
  for (const spec of opts.computedStyle) {
    const el = byId.get(spec.id);
    const elementStyle: ComputedStyle | undefined = el ? styles.get(el) : undefined;
    if (!el || !elementStyle) {
      throw new Error(`${label}: computedStyle requested for unknown id '${spec.id}'`);
    }
    let style: ComputedStyle = elementStyle;
    if (spec.pseudo) {
      const box = elementStyle[spec.pseudo];
      if (!box) {
        throw new Error(`${label}: computedStyle for '${spec.id}::${spec.pseudo}' but no rule targets that pseudo`);
      }
      style = box.style;
    }
    // Key by `${id}::${pseudo}` when a pseudo is queried so the same element
    // can report its ::before and ::after styles without collision.
    computedStyles[spec.pseudo ? `${spec.id}::${spec.pseudo}` : spec.id] = computedStyleFor(style, spec.props, refWidth, viewport);
  }
  return computedStyles;
}

export function renderHtml(html: string, opts: RenderOptions): RenderHtmlOutput {
  const prep = prepare(html, opts, 'renderHtml');
  const { styles, root } = convergeLayout(prep);
  const out = paint(root, opts.width, opts.height, prep.ids, prep.config.defaultFile, prep.factory, prep.viewport, opts.textElements);

  return { ...out, computedStyles: collectComputedStyles(opts, prep.body, styles, prep.viewport, opts.width, 'renderHtml') };
}

/**
 * Snapshot of the geometry layer alone. Runs the cascade + layout and returns
 * the per-id border-box rects without building a canvas or encoding a PNG —
 * the answer "what does this element's border box occupy?" pays for no paint.
 */
export function rectsOf(html: string, opts: RenderOptions): RectsOutput {
  const prep = prepare(html, opts, 'rectsOf');
  const { root } = convergeLayout(prep);
  assertIdsHaveRects(prep.ids, root.rects);
  return { width: opts.width, height: opts.height, rects: root.rects };
}

/**
 * Snapshot of the computed-style layer alone. Resolves the cascade and reports
 * computedStyleFor for `opts.computedStyle` — reports `/computed` values
 * (getComputedStyle serialization), never used values. Stays layout-free for
 * documents without `@container`; a document that uses `@container` runs layout
 * internally to resolve the container sizes a container query needs (a browser
 * applies container queries to computed styles, so the answer must reflect
 * them).
 */
export function computedStylesOf(html: string, opts: RenderOptions): ComputedStylesOutput {
  if (!opts.computedStyle) {
    throw new Error('computedStylesOf: computedStyle specs are required');
  }
  const prep = prepare(html, opts, 'computedStylesOf');
  return {
    width: opts.width,
    height: opts.height,
    computedStyles: collectComputedStyles(opts, prep.body, resolveComputedStyles(prep), prep.viewport, opts.width, 'computedStylesOf'),
  };
}

function collectStyleElements(node: unknown, out: P5Element[]): void {
  const children = (node as { childNodes?: DefaultTreeAdapterTypes.ChildNode[] }).childNodes;
  if (!children) return;
  for (const child of children) {
    if ((child as { nodeName?: string }).nodeName === 'style') {
      out.push(child as P5Element);
    }
    collectStyleElements(child, out);
  }
}

function collectIds(el: P5Element): Record<string, boolean> {
  const ids: Record<string, boolean> = {};
  const walk = (node: P5Element): void => {
    const a = node.attrs.find((x) => x.name === 'id');
    if (a) ids[a.value] = true;
    for (const c of node.childNodes) {
      if (c.nodeName !== '#text' && c.nodeName !== '#comment') walk(c as P5Element);
    }
  };
  walk(el);
  return ids;
}

function collectByElementId(el: P5Element, out: Map<string, P5Element>): void {
  const a = el.attrs.find((x) => x.name === 'id');
  if (a) out.set(a.value, el);
  for (const c of el.childNodes) {
    if (c.nodeName !== '#text' && c.nodeName !== '#comment') collectByElementId(c as P5Element, out);
  }
}