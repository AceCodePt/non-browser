/**
 * Shared render harness for the engine-only verify gates (no browser oracle):
 * the FONT_FILE / FONT_FAMILY fallbacks, the document wrapper, and a typed
 * `render(body)` over `renderHtml`. Centralizing this keeps each gate to just
 * its assertions and gives the gates a single typed surface — `renderHtml`
 * options are checked against the engine's own `RenderOptions` type (see
 * scripts/tsconfig.json).
 *
 * The repo default font is the bundled Hack face, so these gates need no system
 * fonts; FONT_FILE / FONT_FAMILY still override it (matching the oracle gates).
 */
import { resolve } from 'node:path';
import { renderHtml } from '../../dist/index.js';

export const FONT_FILE = process.env.FONT_FILE ?? resolve('fonts/HackNerdFont-Regular.ttf');
export const FONT_FAMILY = process.env.FONT_FAMILY ?? 'Hack Nerd Font';

/**
 * Wrap body markup in a minimal document with a zero-margin body at the shared
 * font. `style` is extra CSS appended to the body rule's stylesheet.
 * @param {string} body
 * @param {string} [style]
 * @returns {string}
 */
export function doc(body, style = '') {
  return `<!doctype html><html><head><style>body{margin:0;font:16px '${FONT_FAMILY}'}${style}</style></head><body>${body}</body></html>`;
}

/**
 * Render body markup through the engine at the given viewport.
 * @param {string} body
 * @param {{ width?: number, height?: number, style?: string }} [opts]
 */
export function render(body, opts = {}) {
  const { width = 800, height = 600, style = '' } = opts;
  return renderHtml(doc(body, style), { width, height, fontFamily: FONT_FAMILY, fontFile: FONT_FILE });
}

/**
 * Normalize a caught value (typed `unknown` under strict) to a message string.
 * @param {unknown} e
 * @returns {string}
 */
export function errorMessage(e) {
  return e instanceof Error ? e.message : String(e);
}
