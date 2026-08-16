import { existsSync } from 'node:fs';
import type { BrowserConfig, FontRegistration } from './browser-config.js';

/**
 * Safari/WebKit browser-config. WebKit resolves CSS families through the
 * platform font backend (fontconfig on Linux/GTK, CoreText on macOS); this
 * config carries the font-registration set WebKit resolves the probe/safari
 * corpus families to, plus a fallback table encoding the deterministic
 * resolution the engine must reproduce so seam measurement and the WebKit
 * oracle measure the same faces. Layout and paint are unchanged — only
 * fallback/font config differs from the chrome config.
 *
 * WebKit itself is the platform-provisioned oracle (charter §8 parks it on
 * macOS CI); the faces below are the concrete fonts this machine's
 * fontconfig/WebKitGTK resolves the assigned CSS families to
 * (`fc-match <family>`, the WebKitGTK font-selection path). Families not
 * listed resolve through fontconfig directly like the engine's own lookup, so
 * they carry no table entry.
 */

const sourceCodePro: FontRegistration = {
  family: 'Source Code Pro',
  filePath: '/usr/share/fonts/adobe-source-code-pro/SourceCodePro-Regular.otf',
};

const liberationMono: FontRegistration = {
  family: 'Liberation Mono',
  filePath: '/usr/share/fonts/liberation-mono/LiberationMono-Regular.ttf',
};

// WebKit's generic `monospace` resolves via fontconfig to this machine's
// fixed-pitch face; register it so pre/code (and the safari mono fixture)
// measure and paint with the same glyphs WebKit uses.
const HACK_MONO = '/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf';
const hasHackMono = existsSync(HACK_MONO);

export const safariConfig: BrowserConfig = {
  browser: 'safari',
  fonts: [
    { family: 'Noto Sans', filePath: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf' },
    sourceCodePro,
    liberationMono,
    { family: 'Liberation Sans', filePath: '/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf' },
    { family: 'Liberation Serif', filePath: '/usr/share/fonts/liberation-serif/LiberationSerif-Regular.ttf' },
    ...(hasHackMono ? [{ family: 'Hack Nerd Font', filePath: HACK_MONO }] : []),
  ],
  // Fallback table: CSS family -> the registered family whose glyphs the
  // safari config's font backend resolves that family to. WebKitGTK resolves
  // through fontconfig, whose aliases on this machine map the metric-compatible
  // families to the Liberation faces installed on disk and `monospace` to the
  // installed fixed-pitch face — so the engine measures/paints those stacks
  // with the same faces the WebKit oracle does.
  fallback: {
    'Courier New': 'Liberation Mono',
    Arial: 'Liberation Sans',
    'sans-serif': 'Liberation Sans',
    'Times New Roman': 'Liberation Serif',
    Georgia: 'Liberation Serif',
    serif: 'Liberation Serif',
    monospace: hasHackMono ? 'Hack Nerd Font' : 'Liberation Mono',
  },
  defaultFamily: 'Noto Sans',
  defaultFile: '/usr/share/fonts/google-noto/NotoSans-Regular.ttf',
};