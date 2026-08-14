import type { BrowserConfig, FontRegistration } from './browser-config.js';

/**
 * Chrome/Blink browser-config. This is the default target: it registers the
 * engine's baseline font set and carries a minimal fallback table (the chrome
 * corpus authors every family explicitly, so no unregistered-family resolution
 * is exercised). Registration paths mirror what the chrome verify scripts pass
 * via FONT_FILE/FONT_FAMILY so the chrome path is unchanged.
 */

const fontFile = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const fontFamily = process.env.FONT_FAMILY ?? 'Noto Sans';

const fonts: FontRegistration[] = [{ family: fontFamily, filePath: fontFile }];

export const chromeConfig: BrowserConfig = {
  browser: 'chrome',
  fonts,
  fallback: {},
  defaultFamily: fontFamily,
  defaultFile: fontFile,
};
