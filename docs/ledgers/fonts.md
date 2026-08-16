# Fonts Ledger

Owning seam: font registration on the Canvas factory
(`src/canvas/skia.ts` → `GlobalFonts.registerFromPath`), driven by
`src/layout/render.ts`. The charter requires fonts to be registered into the
engine **and** installed for the oracle so both resolve identical glyphs.

## Current font set

| Family | Files | Registered by |
| --- | --- | --- |
| Noto Sans | `/usr/share/fonts/google-noto/NotoSans-Regular.ttf` | `renderHtml` via the skia factory |
| Liberation Serif | `/usr/share/fonts/liberation-serif/LiberationSerif-Regular.ttf` | `chromeConfig` (cross-family corpus) |
| Liberation Sans | `/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf` | `chromeConfig` |
| Liberation Mono | `/usr/share/fonts/liberation-mono/LiberationMono-Regular.ttf` | `chromeConfig` |
| DejaVu Sans | `/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf` | `chromeConfig` |
| Source Code Pro | `/usr/share/fonts/adobe-source-code-pro/SourceCodePro-Regular.otf` | `chromeConfig`, `firefoxConfig` |
| Droid Sans Fallback | `/usr/share/fonts/google-droid-sans-fonts/DroidSansFallbackFull.ttf` | `chromeConfig` |

`FONT_FILE` / `FONT_FAMILY` environment variables override the paths used by
the verify scripts. `@napi-rs/canvas` loads `.ttf`/`.woff2` (and `.otf`) files;
a `familyAlias` may be passed to `registerFont` to force a family name for the
glyphs, keeping the CSS font stack and the painted typeface consistent.

The chrome config's fallback table (charter §11; populated from oracle
measurements) maps `Times New Roman`/`Georgia`/`serif` → Liberation Serif,
`Arial`/`sans-serif` → Liberation Sans, and `Courier New` → Liberation Mono, so
the cross-family corpus (`corpus/cross-family/`, `npm run verify:cross-family`)
exercises `resolveFontFamily` at layout time. The firefox table maps `Courier
New`/`Liberation Mono` → Source Code Pro (see `firefox.md`).

## Method

`npm run verify:four-layer` registers the fixture font into the engine and
points Chrome at the same file (via the same system fontconfig lookup); both
sides must resolve the same glyphs for layers 1–4 to agree.

## Divergences

None recorded for the registered single family. Fallback-table resolution
(multi-family stacks, missing-glyph substitution, per-browser tables) is owned
by the text-font-fallback task and records its decisions here.
