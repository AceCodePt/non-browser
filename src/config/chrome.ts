import type { BrowserConfig, FontRegistration } from './browser-config.js';

/**
 * Chrome/Blink browser-config. This is the default target: it registers the
 * engine's baseline font set and carries a fallback table for the CSS families
 * Blink resolves on Linux/fontconfig to faces the engine can reproduce
 * exactly. Registration paths mirror what the chrome verify scripts pass via
 * FONT_FILE/FONT_FAMILY, and the cross-family corpus (corpus/cross-family/)
 * authors CSS font stacks against these registrations and fallback targets.
 *
 * The fallback table is populated from oracle measurements (Chrome
 * `ctx.measureText` for each CSS family vs the engine's registered faces) —
 * entries where Blink resolves a family to a concrete font whose advances the
 * registered face reproduces to sub-pixel. Chrome on Linux/fontconfig resolves
 * the metric-compatible families below to the Liberation faces installed on
 * disk, so the engine measures/paints those stacks with the same glyphs.
 */

const fontFile = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const fontFamily = process.env.FONT_FAMILY ?? 'Noto Sans';

const fonts: FontRegistration[] = [
  { family: fontFamily, filePath: fontFile },
  { family: 'Liberation Serif', filePath: '/usr/share/fonts/liberation-serif/LiberationSerif-Regular.ttf' },
  { family: 'Liberation Sans', filePath: '/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf' },
  { family: 'Liberation Mono', filePath: '/usr/share/fonts/liberation-mono/LiberationMono-Regular.ttf' },
  { family: 'DejaVu Sans', filePath: '/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf' },
  { family: 'Source Code Pro', filePath: '/usr/share/fonts/adobe-source-code-pro/SourceCodePro-Regular.otf' },
  { family: 'Droid Sans Fallback', filePath: '/usr/share/fonts/google-droid-sans-fonts/DroidSansFallbackFull.ttf' },
];

export const chromeConfig: BrowserConfig = {
  browser: 'chrome',
  fonts,
  fallback: {
    'Times New Roman': 'Liberation Serif',
    Georgia: 'Liberation Serif',
    serif: 'Liberation Serif',
    Arial: 'Liberation Sans',
    'sans-serif': 'Liberation Sans',
    'Courier New': 'Liberation Mono',
  },
  defaultFamily: fontFamily,
  defaultFile: fontFile,
};
