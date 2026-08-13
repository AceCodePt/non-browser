# Positioning Ledger

Owning module: `src/layout/positioning.ts` (containing-block resolution, the
§10.3.7/§10.6.4 offset equations, shrink-to-fit width, static-position
fallback), invoked from `src/layout/block-inline.ts` (paint-key assignment,
out-of-flow deferral, relative offsets). Corpus: `corpus/positioning/`.

## Scope

Positioned boxes (CSS 2.1 §9.6, §10.3.7, §10.6.4): `position: relative`
offsets that never affect in-flow layout; `position: absolute` with containing
block resolution against the nearest positioned ancestor (padding box) else the
viewport, top/right/bottom/left offsets, auto-margin centering, static-position
fallback when offsets are auto, and stretch when opposite offsets are both set;
`position: fixed` against the viewport input (no scrolling in scope); and
z-index stacking order with stacking contexts. Static rendering, so fixed
boxes resolve against the viewport input. Verified against Chrome on layer-3
(getBoundingClientRect <= 0.5px) and layer-4 (screenshot within tolerance).
Layer-1 measureText is a bonus; layer-2 computedStyle is empty for these
fixtures (style resolution is owned by the cascade tasks).

## Painting model

Painting follows CSS 2.1 Appendix E, linearized into lexicographic sort keys
per paint op: in-flow backgrounds [3], floats [4], inline [5], positioned
z-auto/0 [6] in tree order, negative z-index [z], positive z-index [6+z].
A positioned box with `z-index` set creates a stacking context (its subtree is
atomic at its level, and its own background paints before its content); a
`position` with `z-index: auto` does not, so its own background and its in-flow
descendants all share level 6 in tree order — the empirical behavior Chrome
produces (a later positive-z sibling paints above such a child, while the whole
group paints above plain in-flow content). Verified pixel-exactly by the box-only
z-index fixtures (unmasked screenshots, 0 exceeding pixels).

## Corpus (14 fixtures)

| Fixture | Covers |
| --- | --- |
| `relative` | top/left and right/bottom offsets; flow position unaffected |
| `absolute-basic` | top/left and right/bottom against the padding box |
| `absolute-viewport` | no positioned ancestor → viewport containing block |
| `absolute-static-position` | auto offsets → static position |
| `absolute-auto-margins` | auto margins center a sized abs box |
| `absolute-stretch` | all four offsets set → stretch; content overflows |
| `containing-block-nested` | abs inside abs; padding box of the ancestor |
| `containing-block-percent` | % offsets/width vs the padding box; content-based CB height |
| `fixed` | fixed ignores positioned ancestors, anchors to the viewport |
| `static-position-margins` | static position tracks ancestor margins |
| `z-index-order` | negative / auto / 0 / positive z-index ordering |
| `z-index-stacking-context` | z-index creates an atomic stacking context |
| `z-index-negative-inside-sc` | negative z-index resolves against its context |
| `z-index-auto-child` | z-index:auto child paints above in-flow but below positive z |

## Paint-layer masking (known divergence)

Identical to the floats/grid corpora: Chrome's Skia rasterizes glyph coverage
slightly differently than `@napi-rs/canvas`, so text glyph ink exceeds the
charter's per-pixel delta-E and is masked from Chrome's own line-fragment rects
(`Range.getClientRects()`, padded 2px). Only the two fixtures with text
(`absolute-static-position`) are masked; every other fixture is unmasked and
pixel-perfect (0 exceeding pixels, worst ΔE 0) — which is what verifies the
z-index painted order strictly.

## Results

`npm run verify:layout-positioning` exits 0. All 14 fixtures pass all four
layers: layer-3 rects match Chrome to <= 0.0001px (max Δ across the corpus),
layer-4 worst ΔE 0.0000 with 0 exceeding pixels in every fixture (masked text
aside). The reference `reference.json`/`reference.png`/`mask.png` are harvested
live from Chrome by the verify script and committed as golden data;
`candidate.*` is the engine's output.

## Divergences

None in the verified surface. Out-of-flow boxes are laid out after their
containing block's in-flow content (Blink's `layoutPositionedObjects` strategy,
required so percentages resolve against the used content height); positioned
descendants of one containing block therefore keep tree order among themselves,
and the exotic case of two same-level overlapping boxes in *different*
containing-block subtrees is not exercised by the corpus. Abs/fixed boxes as
grid or flex *items* are out of scope (their containers own item placement).
