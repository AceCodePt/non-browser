# Grid Ledger

Owning module: `src/layout/grid.ts` (track parsing, track sizing, auto-placement,
alignment), invoked from a `display:grid` branch in `src/layout/block-inline.ts`.
Corpus: `corpus/grid/`.

## Scope

CSS Grid layout matching Blink's track sizing algorithm (css-grid-1 §11,
mirroring Chromium's `GridTrackSizingAlgorithm`): explicit/implicit tracks with
px, %, fr, minmax, auto, min-content, max-content, fit-content and repeat();
intrinsic sizing with spanning-item space distribution; maximize / expand-flexible
/ stretch-auto steps; auto-placement (row & column flow, span, dense) per §8.5;
and justify/align items/self, justify/align content, and gap. Verified against
Chrome on layer-3 (getBoundingClientRect <= 0.5px) and layer-4 (screenshot
within tolerance). Layer-1 measureText is a bonus; layer-2 computedStyle is
empty for these fixtures (style resolution is owned by the cascade tasks).

## Corpus (13 fixtures)

| Fixture | Covers |
| --- | --- |
| `explicit-tracks` | px + fr columns, fixed/auto rows, gap |
| `fr-distribution` | minmax(60px,1fr) + 1fr + 2fr with a spanning item |
| `minmax-fitcontent` | minmax(), fit-content(), auto columns with text |
| `repeat-percent` | repeat() and percentage tracks |
| `areas` | grid-template-areas with a spanning header/footer |
| `auto-flow` | row auto-placement, implicit rows via grid-auto-rows |
| `auto-flow-span` | auto-placement around occupied cells with spans |
| `dense` | grid-auto-flow: dense back-filling |
| `implicit-tracks` | grid-auto-columns/rows creating implicit tracks |
| `alignment-items` | justify/align-items with a per-item self override |
| `alignment-content` | justify-content space-between, align-content center |
| `text-rows` | auto rows sized by single-line and wrapped text |
| `column-flow` | grid-auto-flow: column packing |

## Paint-layer masking (known divergence)

Chrome's Skia rasterizes glyph coverage slightly differently than
`@napi-rs/canvas`, so text glyph ink exceeds the per-pixel delta-E. Text is
therefore masked on the paint layer (masks generated from Chrome's own
line-fragment rects, padded 2px). The grid geometry — track sizes, item
placement, spanning, alignment — is still verified exactly on layer-3, and every
non-glyph pixel (boxes, backgrounds, gaps) is compared strictly. The two
text-bearing fixtures (`minmax-fitcontent`, `text-rows`) are masked; the
box-only fixtures are unmasked and pixel-perfect.

## Results

`npm run verify:layout-grid` exits 0. All 13 fixtures pass all four layers:
layer-3 rects match Chrome to <= 0.01px (max Δ across the corpus), layer-4
worst ΔE 0.0000 with 0 exceeding pixels in every fixture (masked text aside).
The reference `reference.json`/`reference.png`/`mask.png` are harvested live
from Chrome by the verify script and committed as golden data; `candidate.*` is
the engine's output. `npm run verify:layout-floats` still exits 0 (no regressions
in the sibling layout module).

## Divergences

None in the verified surface. Behavior not covered by this task (auto-fill /
auto-fit repeat(), baseline alignment, aspect-ratio items, subgrid,
absolutely-positioned grid items, `order`-modified placement) is out of scope
and not exercised by the corpus.
