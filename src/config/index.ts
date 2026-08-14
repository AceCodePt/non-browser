import { chromeConfig } from './chrome.js';
import { firefoxConfig } from './firefox.js';
import type { BrowserConfig, BrowserTarget } from './browser-config.js';

export * from './browser-config.js';
export { chromeConfig } from './chrome.js';
export { firefoxConfig } from './firefox.js';

const registry: Record<BrowserTarget, BrowserConfig> = {
  chrome: chromeConfig,
  firefox: firefoxConfig,
};

/** The browser-config for a target (chrome by default). */
export function getBrowserConfig(target: BrowserTarget = 'chrome'): BrowserConfig {
  return registry[target];
}
