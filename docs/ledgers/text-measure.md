# Text-Measure Ledger

Owning seam: the generic Canvas interface (`src/canvas/`) with the skia
implementation (`src/canvas/skia.ts`); measurement consumers live in
`src/layout/measure.ts` (via `measureTextWidth`) and Pretext's measurement
context (see `src/pretext/`). Layer-1 corpus: the `measureText` block of every
`corpus/spine/` fixture.

## Scope

Per-string advances resolved against the registered font set: `measureText`
returns the shaped advance (kerning, glyph substitution) for a CSS font
shorthand string, matching Chrome's `canvas.measureText` exactly — both ride
Skia with the same registered typefaces, so the layer-1 tolerance is sub-pixel.

## Method

`npm run verify:four-layer` harvests Chrome's `ctx.measureText(text).width` for
each fixture string and compares against the engine's `measureTextWidth`.
Deltas are reported per fixture (mean and max); the charter tolerance is
`<0.01px` mean, no string `>0.5px` (`tolerances.json`).

## Results

All five `corpus/spine/` fixtures pass layer 1: mean Δ `<= 0.004px`, max Δ
`<= 0.0042px` across 11 strings (see the per-run report under `docs/reports/`).
Sibling corpora (`paint-text`, `floats`, `grid`) continue to pass with the same
seam after measurement moved onto the Canvas interface.

## Divergences

None recorded. Known measurement surface not yet covered by the corpus:
CJK/grapheme clusters, kerning-heavy pairs at large sizes, `text-rendering`
variants, and fallback-font resolution beyond the single registered family
(font-fallback and segmenter/ICU parity are tracked in their own ledgers).
