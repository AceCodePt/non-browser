import { chromeConfig } from './chrome.js';
import { firefoxConfig } from './firefox.js';
import { safariConfig } from './safari.js';
import type { BrowserConfig, BrowserTarget } from './browser-config.js';

export * from './browser-config.js';
export { chromeConfig } from './chrome.js';
export { firefoxConfig } from './firefox.js';
export { safariConfig } from './safari.js';

const registry: Record<BrowserTarget, BrowserConfig> = {
  chrome: chromeConfig,
  firefox: firefoxConfig,
  safari: safariConfig,
};

export function getBrowserConfig(target: BrowserTarget = 'chrome'): BrowserConfig {
  return registry[target];
}
