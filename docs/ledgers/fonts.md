# Fonts Ledger

Owning seam: font registration on the Canvas factory
(`src/canvas/skia.ts` → `GlobalFonts.registerFromPath`), driven by
`src/layout/render.ts`. The charter requires fonts to be registered into the
engine **and** installed for the oracle so both resolve identical glyphs.

## Current font set

| Family | Files | Registered by |
| --- | --- | --- |
| Noto Sans | `/usr/share/fonts/google-noto/NotoSans-Regular.ttf` | `renderHtml` via the skia factory |

`FONT_FILE` / `FONT_FAMILY` environment variables override the paths used by
the verify scripts. `@napi-rs/canvas` loads `.ttf`/`.woff2` (and `.otf`) files;
a `familyAlias` may be passed to `registerFont` to force a family name for the
glyphs, keeping the CSS font stack and the painted typeface consistent.

## Method

`npm run verify:four-layer` registers the fixture font into the engine and
points Chrome at the same file (via the same system fontconfig lookup); both
sides must resolve the same glyphs for layers 1–4 to agree.

## Divergences

None recorded for the registered single family. Fallback-table resolution
(multi-family stacks, missing-glyph substitution, per-browser tables) is owned
by the text-font-fallback task and records its decisions here.
