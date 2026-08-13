# Floats Ledger

Owning module: `src/layout/floats.ts` (placement + clearance), `src/layout/block-inline.ts`
(formatting-context interface it extends), corpus `corpus/floats/`.

## Scope

Float placement (left/right), line-box shortening around floats, `clear`
left/right/both with clearance, and the margin-collapsing interaction with
clearance. Verified against Chrome on layer-3 (getBoundingClientRect <= 0.5px)
and layer-4 (screenshot within tolerance). Layer-1 measureText is included as a
bonus; layer-2 computedStyle is empty for these fixtures (style resolution is
owned by the cascade tasks, not this one).

## Corpus (10 fixtures)

| Fixture | Covers |
| --- | --- |
| `float-left` | single left float, text wraps around it |
| `float-right` | single right float |
| `float-margins` | float margin/padding/border; margin box drives intrusion |
| `float-two-left` | two left floats side by side |
| `float-mixed` | left + right float on the same band |
| `float-wrap-multi` | changing intrusion per vertical band |
| `clear-left` | clearance below a left float (no text, fully strict screenshot) |
| `clear-both` | clearance to the lowest of left+right floats |
| `clear-margin-collapse` | margin collapse + clearance interaction (§9.5.2) |
| `float-negative-margin` | negative right margin shrinks the intrusion |

## Paint-layer masking (known divergence)

Chrome's Skia rasterizes glyph coverage slightly differently than
`@napi-rs/canvas` (both grayscale AA, but different filter/gamma paths), so text
glyph ink exceeds the charter's per-pixel delta-E. Text is therefore masked on
the paint layer: masks are generated from Chrome's own line-fragment rects
(`Range.getClientRects()`, padded 2px) so they track the text wherever it
wraps. The text **geometry** (line boxes, paragraph rects, float intrusion) is
still verified exactly on layer-3, and every non-glyph pixel — float boxes,
backgrounds, borders, margins — is compared strictly. Box-only fixtures
(`clear-*`) are unmasked and pixel-perfect (0 exceeding pixels, worst ΔE 0).

## Results

`npm run verify:layout-floats` exits 0. All 10 fixtures pass all four layers:
layer-3 rects match Chrome to <= 0.0001px (max Δ across the corpus), layer-4
worst ΔE 0.0000 with 0 exceeding pixels in every fixture (masked text aside).
The reference `reference.json`/`reference.png`/`mask.png` are harvested live
from Chrome by the verify script and committed as golden data; `candidate.*` is
the engine's output.

## Divergences

None in the verified surface. Behavior not covered by this task (flex/grid
items with floats, floats interleaved with inline content mid-paragraph) is out
of scope and not exercised by the corpus.
