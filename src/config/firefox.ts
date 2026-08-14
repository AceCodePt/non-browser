import type { BrowserConfig, FontRegistration } from './browser-config.js';

/**
 * Firefox/Gecko browser-config. Gecko resolves several common CSS families to
 * different concrete fonts than Blink on Linux/fontconfig; this config's
 * fallback table encodes the resolution the engine must reproduce to match the
 * Firefox oracle, and `fonts` is the firefox font-registration set the engine
 * registers into the skia Canvas interface. Layout and paint are unchanged —
 * only fallback/font config differs from the chrome config.
 *
 * The firefox corpus (corpus/firefox-track/) is authored against these
 * registrations: families listed here (or their fallback targets) measure and
 * paint with glyphs Firefox and skia agree on to sub-pixel.
 */

const sourceCodePro: FontRegistration = {
  family: 'Source Code Pro',
  filePath: '/usr/share/fonts/adobe-source-code-pro/SourceCodePro-Regular.otf',
};

const nimbusMono: FontRegistration = {
  family: 'Nimbus Mono PS',
  filePath: '/usr/share/fonts/urw-base35/NimbusMonoPS-Regular.otf',
};

export const firefoxConfig: BrowserConfig = {
  browser: 'firefox',
  fonts: [sourceCodePro, nimbusMono],
  // Fallback table: CSS family -> the registered family whose glyphs Firefox
  // resolves that family to. Gecko resolves these mono families to a face with
  // the same advances as Source Code Pro (verified against the oracle
  // measureText at every corpus size), while the engine's raw font lookup
  // would resolve them differently — so the engine measures/paints with the
  // registered face and reproduces Gecko's widths exactly.
  fallback: {
    'Courier New': 'Source Code Pro',
    'Liberation Mono': 'Source Code Pro',
  },
  defaultFamily: 'Source Code Pro',
  defaultFile: '/usr/share/fonts/adobe-source-code-pro/SourceCodePro-Regular.otf',
};
