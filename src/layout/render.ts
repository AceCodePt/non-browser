/**
 * Top-level render path: parse5 HTML → inline-style cascade → layout → paint.
 * The subset of CSS the floats corpus needs is supported; the viewport is an
 * input, the output is an RGBA pixel buffer plus per-id border-box rects.
 */

import { parse, type DefaultTreeAdapterTypes } from 'parse5';
import { GlobalFonts } from '@napi-rs/canvas';
import { resolveStyles, layoutRoot } from './block-inline.js';
import { paint, type RenderOutput } from './paint.js';
import { initMeasurement } from './measure.js';
import type { P5Element } from './types.js';

export interface RenderOptions {
  width: number;
  height: number;
  /** CSS family name for measurement (e.g. 'Noto Sans'). */
  fontFamily: string;
  /** Path to the TTF that both the engine and the Chrome oracle resolve to. */
  fontFile: string;
  fontSize?: number;
  lineHeight?: number;
}

/**
 * Render an HTML document. Returns the painted pixel buffer and the
 * getBoundingClientRect values for every element that carries an `id`.
 */
export function renderHtml(html: string, opts: RenderOptions): RenderOutput {
  const doc = parse(html);
  const htmlEl = (doc as unknown as { childNodes: DefaultTreeAdapterTypes.ChildNode[] }).childNodes.find(
    (n) => n.nodeName === 'html',
  ) as P5Element;
  const body = htmlEl?.childNodes.find((n) => n.nodeName === 'body') as P5Element;
  if (!body) throw new Error('renderHtml: no <body> element in input');

  GlobalFonts.registerFromPath(opts.fontFile);
  initMeasurement({ family: opts.fontFamily, filePath: opts.fontFile });

  const styles = resolveStyles(body, {
    fontFamily: opts.fontFamily,
    fontSize: opts.fontSize ?? 16,
    lineHeight: opts.lineHeight ?? 19,
    color: { r: 0, g: 0, b: 0, a: 1 },
    letterSpacing: 0,
    textDecorationLines: [],
    textDecorationColor: null,
    textDecorationThickness: 'auto',
    textUnderlineOffset: 0,
  });

  const root = layoutRoot(body, styles, opts.width);
  return paint(root, opts.width, opts.height, Object.keys(collectIds(body)), opts.fontFile);
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
