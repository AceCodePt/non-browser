# Fonts Ledger

Owning seam: font registration on the Canvas factory
(`src/canvas/skia.ts` → `GlobalFonts.registerFromPath`), driven by
`src/layout/render.ts`. The charter requires fonts to be registered into the
engine **and** installed for the oracle so both resolve identical glyphs.

## Current font set

| Family | Files | Registered by |
| --- | --- | --- |
| Noto Sans | `/usr/share/fonts/google-noto/NotoSans-Regular.ttf` | `renderHtml` via the skia factory |
| Noto Sans Thai | `fonts/NotoSansThai-Regular.ttf` (vendored; env `NOTO_SANS_THAI_PATH`) | `chromeConfig` |
| Noto Color Emoji | `fonts/NotoColorEmoji.ttf` (vendored; env `NOTO_COLOR_EMOJI_PATH`) | `chromeConfig` |
| Hack Nerd Font (monospace) | `fonts/HackNerdFont-Regular.ttf` (vendored; env `HACK_FONT_PATH`) | `chromeConfig` |
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

The Thai, emoji, and Hack faces are the machine-calibrated set: their files are
vendored under `fonts/` (byte-identical to the user-level installs Chrome's
fontconfig resolves: `~/.local/share/fonts/` + `fc-cache`), and each path
resolves through an env var first (`NOTO_SANS_THAI_PATH`,
`NOTO_COLOR_EMOJI_PATH`, `HACK_FONT_PATH`) with graceful fallback to the
vendored copy — registration paths carry no hard-coded home directory. A face
whose file is absent is skipped and its generic falls back (e.g. `monospace` →
Liberation Mono).

The chrome config's fallback table (charter §11; populated from oracle
measurements) maps `Times New Roman`/`Georgia`/`serif` → Liberation Serif,
`Arial`/`sans-serif` → Liberation Sans, `Courier New` → Liberation Mono, and
`monospace` → Hack Nerd Font (falling back to Liberation Mono), plus the
registered Thai/emoji families (`Noto Sans Thai`, `Noto Color Emoji`) so a CSS
stack naming them resolves deterministically; the cross-family corpus
(`corpus/cross-family/`, `npm run verify:cross-family`) exercises
`resolveFontFamily` at layout time. The firefox table maps `Courier
New`/`Liberation Mono` → Source Code Pro (see `firefox.md`). The safari table
(`src/config/safari.ts`) resolves the generics and metric-compatible families
through the host's fontconfig resolution — `Courier New` → Liberation Mono,
`Arial`/`sans-serif` → Liberation Sans, `Times New Roman`/`Georgia`/`serif` →
Liberation Serif, `monospace` → the installed fixed-pitch face (Hack Nerd Font
when present, else Liberation Mono) — see `safari.md`.

Pretext's measurement context resolves the same authority the engine measure
path uses: `src/pretext/index.ts` resolves the CSS family inside the font
shorthand through the active config via `resolveFontFamily` before the Canvas is
touched (identical to `cssFontString` in `src/layout/measure.ts`), so the seam
and the engine measure the same per-browser faces for any fixture family.

## Per-glyph script-run fallback

Chrome splits mixed-script strings into script runs and resolves each run's
missing glyphs through fontconfig, so a single CSS family can land on several
faces (Latin + Droid Sans Fallback + Noto Color Emoji for `"abc 中文 😀 def"`).
The engine reproduces that at the single measurement choke point,
`SkiaCanvas.measureText` (src/canvas/skia.ts), via a run-splitting shim
(`src/canvas/script-fallback.ts`) that both the engine's `measureTextWidth`
and the Pretext seam funnel through, so both measure the same per-run faces.

Decisions:

- **Script-run splitting.** Text is split into extended grapheme clusters
  (`Intl.Segmenter`) and each cluster's face is resolved from a script group:
  strong scripts map through their Unicode script property, and
  Common/Inherited clusters (spaces, punctuation, combining marks) attach to a
  group from their codepoint range (ASCII punctuation falls like Latin, CJK
  punctuation like Han, Arabic-Indic digits like Arabic). Whitespace and
  control characters always stay in the primary face, matching Chrome keeping
  spaces and tab stops in the primary font.
- **Per-script fallback preference** lives in the browser-config as
  `scriptFallback` (`chromeConfig`: `Latn`→Liberation Serif, `Hani`→Droid Sans
  Fallback, `Thai`→Noto Sans Thai, `Arab`→Droid Arabic Kufi, `Hebr`→Droid Sans
  Hebrew, `Deva`→Droid Sans Devanagari, `Emoji`→Noto Color Emoji). `Latn`→
  Liberation Serif is the machine-calibrated face fontconfig resolves missing
  Latin to on this system (measured against the Chrome oracle). An empty table
  disables run-splitting, so configs without per-script data (firefox, safari)
  keep measuring through the single-face seam.
- **Glyph-coverage gating.** A run only changes face when the active family
  genuinely lacks its script, decided by the config's `scriptCoverage` table
  (family → script groups it covers), not by a width heuristic — a covered
  glyph's advance can equal the face's .notdef advance (e.g. Noto Sans's "V"
  at 0.6em, full-width Han on Droid Sans Fallback, tabs on monospace faces), so
  width-only glyph detection misreads real glyphs as missing. The shim is a
  no-op whenever one registered face covers the whole run.
- **Measurement.** Contiguous same-face clusters are measured as one segment
  so kerning and script joining survive; widths sum across segments. The
  reclassified mixed-script strings (mixed-script/, rtl/) close the layer-1
  deltas to ≤ 0.5px (see text-measure.md; known-gaps 5 → 2: proportional-font
  tabs and Arabic letter-spacing remain).

## Method

`npm run verify:four-layer` registers the fixture font into the engine and
points Chrome at the same file (via the same system fontconfig lookup); both
sides must resolve the same glyphs for layers 1–4 to agree.

## Divergences

None recorded for the registered single family. Fallback-table resolution
(multi-family stacks, missing-glyph substitution, per-browser tables) is owned
by the text-font-fallback task and records its decisions here.
