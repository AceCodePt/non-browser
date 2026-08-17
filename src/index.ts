/**
 * Module boundary — package.json `exports` resolves consumers only to this
 * file, so everything a package consumer can import comes from here.
 * Deep-dist imports stay reachable inside the repo for the verify/harness
 * scripts, but the charter §§4–5 contract is intentional: renderHtml, its
 * option/output shapes, and the browser-config selection — nothing else.
 */

export {
  renderHtml,
  type RenderOptions,
  type RenderHtmlOutput,
  type ComputedStyleSpec,
  type MediaInput,
} from './layout/render.js';

export {
  getBrowserConfig,
  chromeConfig,
  firefoxConfig,
  safariConfig,
  type BrowserConfig,
  type BrowserTarget,
  type FontRegistration,
} from './config/index.js';