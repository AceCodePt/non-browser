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
import { fontVerticalMetrics, setActiveFontMetrics } from './fontmetrics.js';
import type { ComputedStyle, Viewport } from './css.js';
import type { P5Element } from './types.js';
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

export function renderHtml(html: string, opts: RenderOptions): RenderHtmlOutput {
  const doc = parse(html);
  const htmlEl = (doc as unknown as { childNodes: DefaultTreeAdapterTypes.ChildNode[] }).childNodes.find(
    (n) => n.nodeName === 'html',
  ) as P5Element;
  const body = htmlEl?.childNodes.find((n) => n.nodeName === 'body') as P5Element;
  if (!body) throw new Error('renderHtml: no <body> element in input');

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
  const cascade = resolveMediaCascade(body, styleElements, mediaEnv);

  const styles = resolveStyles(
    body,
    {
      fontFamily: opts.fontFamily,
      fontSize: opts.fontSize ?? 16,
      lineHeight: opts.lineHeight ?? 'normal',
      color: { r: 0, g: 0, b: 0, a: 1 },
      letterSpacing: 0,
      textDecorationLines: [],
      textDecorationColor: null,
      textDecorationThickness: 'auto',
      textUnderlineOffset: 0,
    },
    cascade.element,
    cascade.pseudo,
  );

  const root = layoutRoot(body, styles, viewport);
  const out = paint(root, opts.width, opts.height, Object.keys(collectIds(body)), config.defaultFile, factory, viewport, opts.textElements);

  const computedStyles: Record<string, ComputedStyleProps> = {};
  if (opts.computedStyle) {
    const byId = new Map<string, P5Element>();
    collectByElementId(body, byId);
    for (const spec of opts.computedStyle) {
      const el = byId.get(spec.id);
      const elementStyle: ComputedStyle | undefined = el ? styles.get(el) : undefined;
      if (!el || !elementStyle) {
        throw new Error(`renderHtml: computedStyle requested for unknown id '${spec.id}'`);
      }
      let style: ComputedStyle = elementStyle;
      if (spec.pseudo) {
        const box = elementStyle[spec.pseudo];
        if (!box) {
          throw new Error(`renderHtml: computedStyle for '${spec.id}::${spec.pseudo}' but no rule targets that pseudo`);
        }
        style = box.style;
      }
      // Key by `${id}::${pseudo}` when a pseudo is queried so the same element
      // can report its ::before and ::after styles without collision.
      computedStyles[spec.pseudo ? `${spec.id}::${spec.pseudo}` : spec.id] = computedStyleFor(style, spec.props, opts.width, viewport);
    }
  }

  return { ...out, computedStyles };
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
