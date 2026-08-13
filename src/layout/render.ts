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
 */

import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import type { CanvasFactory, CanvasLike } from '../canvas/interface.js';
import { skiaCanvasFactory } from '../canvas/skia.js';
import { installPretextMeasurement } from '../pretext/index.js';
import { resolveMediaCascade, type MediaEnvironment } from '../cascade/index.js';
import { resolveStyles, layoutRoot } from './block-inline.js';
import { computedStyleFor, type ComputedStyleProps } from './computed-style.js';
import { paint, type RenderOutput } from './paint.js';
import { initMeasurement } from './measure.js';
import type { ComputedStyle, Viewport } from './css.js';
import type { P5Element } from './types.js';

export interface ComputedStyleSpec {
  id: string;
  props: string[];
}

/** Media-feature inputs beyond the viewport dimensions (media-queries phase). */
export interface MediaInput {
  prefersColorScheme?: 'light' | 'dark';
  prefersReducedMotion?: 'no-preference' | 'reduce';
  /** device resolution in dppx; default 1. */
  dppx?: number;
}

export interface RenderOptions {
  width: number;
  height: number;
  /** CSS family name for measurement (e.g. 'Noto Sans'). */
  fontFamily: string;
  /** Path to the TTF that both the engine and the Chrome oracle resolve to. */
  fontFile: string;
  fontSize?: number;
  lineHeight?: number;
  /** Canvas implementation; defaults to skia. */
  canvasFactory?: CanvasFactory;
  /** When set, resolve these computed-style properties per id (layer 2). */
  computedStyle?: ComputedStyleSpec[];
  /** Media-feature inputs for @media evaluation (defaults: light, no-preference, 1x). */
  media?: MediaInput;
}

export interface RenderHtmlOutput extends RenderOutput {
  /** computed-style strings per id (present when opts.computedStyle is set). */
  computedStyles: Record<string, ComputedStyleProps>;
}

/**
 * Render an HTML document. Returns the painted pixel buffer, the
 * getBoundingClientRect values for every element that carries an `id`, and the
 * requested computed styles.
 */
export function renderHtml(html: string, opts: RenderOptions): RenderHtmlOutput {
  const doc = parse(html);
  const htmlEl = (doc as unknown as { childNodes: DefaultTreeAdapterTypes.ChildNode[] }).childNodes.find(
    (n) => n.nodeName === 'html',
  ) as P5Element;
  const body = htmlEl?.childNodes.find((n) => n.nodeName === 'body') as P5Element;
  if (!body) throw new Error('renderHtml: no <body> element in input');

  const factory = opts.canvasFactory ?? skiaCanvasFactory;
  factory.registerFont(opts.fontFile);
  const measureCanvas: CanvasLike = initMeasurement(
    { family: opts.fontFamily, filePath: opts.fontFile },
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
  const stylesheetDecls = resolveMediaCascade(body, styleElements, mediaEnv);

  const styles = resolveStyles(
    body,
    {
      fontFamily: opts.fontFamily,
      fontSize: opts.fontSize ?? 16,
      lineHeight: opts.lineHeight ?? 19,
      color: { r: 0, g: 0, b: 0, a: 1 },
      letterSpacing: 0,
      textDecorationLines: [],
      textDecorationColor: null,
      textDecorationThickness: 'auto',
      textUnderlineOffset: 0,
    },
    stylesheetDecls,
  );

  const root = layoutRoot(body, styles, viewport);
  const out = paint(root, opts.width, opts.height, Object.keys(collectIds(body)), opts.fontFile, factory);

  const computedStyles: Record<string, ComputedStyleProps> = {};
  if (opts.computedStyle) {
    const byId = new Map<string, P5Element>();
    collectByElementId(body, byId);
    for (const spec of opts.computedStyle) {
      const el = byId.get(spec.id);
      const style: ComputedStyle | undefined = el ? styles.get(el) : undefined;
      if (!el || !style) {
        throw new Error(`renderHtml: computedStyle requested for unknown id '${spec.id}'`);
      }
      computedStyles[spec.id] = computedStyleFor(style, spec.props, opts.width, viewport);
    }
  }

  return { ...out, computedStyles };
}

/** Collect every `<style>` element in the document (head and body). */
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
