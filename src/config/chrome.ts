import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
 *
 * Registration resolution: paths never hard-code a user's home directory. Each
 * machine-calibrated face resolves via an env var override when set, and falls
 * back to the repo-vendored copy under fonts/ (byte-identical to the
 * user-level install used by Chrome's fontconfig). A face whose file is absent
 * on disk is simply not registered — the fallback table then resolves its
 * generic (e.g. `monospace` -> Liberation Mono) — so the set reproduces on
 * another machine with the same vendored fonts.
 */

const repoFontsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fonts');

/**
 * Resolve a face's registration path without hard-coding a home directory.
 * Env override first (absolute); absent/unreadable it falls back to the
 * repo-vendored copy, registered RELATIVE to the repo root (`fonts/<file>`) so
 * the registered set carries no machine-specific absolute path and reproduces
 * on another machine checked out anywhere. Null when neither exists — callers
 * then omit the face and the fallback table handles its generic.
 */
function fontPath(envVar: string | undefined, repoFile: string): string | null {
  if (envVar) {
    const p = resolve(envVar);
    if (existsSync(p)) return p;
    console.warn(`chrome-config: ${envVar} set but missing (${p}); falling back to repo copy`);
  }
  return existsSync(join(repoFontsDir, repoFile)) ? `fonts/${repoFile}` : null;
}

const fontFile = process.env.FONT_FILE ?? '/usr/share/fonts/google-noto/NotoSans-Regular.ttf';
const fontFamily = process.env.FONT_FAMILY ?? 'Noto Sans';

// Bold/italic faces of the default family (e.g. NotoSans-Bold.ttf) so strong/b
// and em/i measure and paint with the same faces Chrome's fontconfig resolves.
const dir = fontFile.includes('/') ? fontFile.slice(0, fontFile.lastIndexOf('/')) : '';
const base = fontFile.slice(fontFile.lastIndexOf('/') + 1).replace(/\.ttf$/i, '').replace(/-Regular$/i, '');
const boldPath = `${dir}/${base}-Bold.ttf`;
const italicPath = `${dir}/${base}-Italic.ttf`;

// The generic `monospace` family resolves via fontconfig to this machine's
// fixed-pitch face; register it so pre/code measure and paint with the same
// glyphs Chrome uses. Falls back to Liberation Mono when absent.
const hackPath = fontPath(process.env.HACK_FONT_PATH, 'HackNerdFont-Regular.ttf');

// Thai- and emoji-capable faces. Noto Sans Thai reproduces Chrome's Thai
// resolution to sub-pixel (see corpus/measure-corpus/thai/); Noto Color Emoji
// is the engine-side registration of the face Chrome's fontconfig resolves
// emoji strings to. Both resolve via env override or the vendored repo copy.
const thaiPath = fontPath(process.env.NOTO_SANS_THAI_PATH, 'NotoSansThai-Regular.ttf');
const emojiPath = fontPath(process.env.NOTO_COLOR_EMOJI_PATH, 'NotoColorEmoji.ttf');

const fonts: FontRegistration[] = [
  { family: fontFamily, filePath: fontFile },
  ...(existsSync(boldPath) ? [{ family: fontFamily, filePath: boldPath }] : []),
  ...(existsSync(italicPath) ? [{ family: fontFamily, filePath: italicPath }] : []),
  ...(hackPath ? [{ family: 'Hack Nerd Font', filePath: hackPath }] : []),
  ...(thaiPath ? [{ family: 'Noto Sans Thai', filePath: thaiPath }] : []),
  ...(emojiPath ? [{ family: 'Noto Color Emoji', filePath: emojiPath }] : []),
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
    monospace: hackPath ? 'Hack Nerd Font' : 'Liberation Mono',
    // Chrome/fontconfig resolves these families deterministically to the same
    // installed faces the engine registers above, so a CSS stack naming them
    // lands on identical glyphs (register-first, table second per §4).
    'Noto Sans Thai': 'Noto Sans Thai',
    'Noto Color Emoji': 'Noto Color Emoji',
  },
  // Per-glyph script-run fallback (per-glyph-fallback): Chrome splits mixed-
  // script strings into script runs and resolves each run's missing glyphs
  // through fontconfig. This table names the face fontconfig resolves each
  // script group's missing glyphs to on this machine (measured against the
  // Chrome oracle: a missing Latin glyph falls to Liberation Serif, Han to
  // Droid Sans Fallback, Thai to Noto Sans Thai, Arabic to Droid Arabic Kufi,
  // emoji to Noto Color Emoji). `scriptCoverage` below records which script
  // groups each registered family genuinely covers, so the shim only changes
  // face when the active face lacks a run's script (see
  // src/canvas/script-fallback.ts).
  scriptFallback: {
    Latn: 'Liberation Serif',
    Hani: 'Droid Sans Fallback',
    Thai: 'Noto Sans Thai',
    Arab: 'Droid Arabic Kufi',
    Hebr: 'Droid Sans Hebrew',
    Deva: 'Droid Sans Devanagari',
    Emoji: 'Noto Color Emoji',
  },
  scriptCoverage: {
    'Noto Sans': ['Latn'],
    'DejaVu Sans': ['Latn', 'Emoji'],
    'Liberation Sans': ['Latn'],
    'Liberation Serif': ['Latn'],
    'Liberation Mono': ['Latn'],
    'Source Code Pro': ['Latn'],
    'Hack Nerd Font': ['Latn'],
    'Droid Sans Fallback': ['Hani'],
    'Droid Sans Japanese': ['Hani'],
    'Droid Arabic Kufi': ['Arab'],
    'Droid Sans Hebrew': ['Hebr'],
    'Droid Sans Devanagari': ['Deva'],
    'Noto Sans Thai': ['Thai'],
    'Noto Color Emoji': ['Emoji'],
  },
  defaultFamily: fontFamily,
  defaultFile: fontFile,
};
