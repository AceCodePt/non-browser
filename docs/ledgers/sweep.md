# Value-Sweep Ledger

Programmatic breadth for the charter §11 coverage matrix: `scripts/generate-sweep.mjs` sweeps property/value axes, generates one fixture per combination into `corpus/sweep-flexbox/` and `corpus/sweep-grid/`, and records each combo's measured parity. `npm run verify:sweep` re-diffs all four layers against Chrome and asserts the recorded expectations still hold. Nothing here is hand-authored.

## Axes

- **flex-wrap**: nowrap, wrap, wrap-reverse
- **justify-content**: flex-start, flex-end, center, space-between, space-around, space-evenly
- **align-items**: stretch, flex-start, flex-end, center, baseline
- **grid-template-columns**: 1fr 1fr ; repeat(2, 80px) ; minmax(60px, 1fr) 1fr ; 100px 1fr 2fr ; repeat(2, 30%) 1fr
- **gap**: 0, 4px, 8px, 12px

## Latest Run

- Generated: 2026-08-18T01:48:03.351Z
- Fixtures swept: 110
- Passing: 110
- Documented divergences (typed gaps, still diverging): 0

## Swept Fixtures

| Fixture | Feature | Expected | Gap layers | Rect max Δ px | Screenshot exceed % | Result |
|---|---|---|---|---|---|---|
| flex-nowrap-center-baseline | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-center-center | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-center-flex-end | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-center-flex-start | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-center-stretch | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-end-baseline | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-end-center | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-end-flex-end | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-end-flex-start | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-end-stretch | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-start-baseline | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-start-center | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-start-flex-end | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-start-flex-start | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-flex-start-stretch | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-around-baseline | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-around-center | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-around-flex-end | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-around-flex-start | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-around-stretch | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-between-baseline | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-between-center | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-between-flex-end | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-between-flex-start | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-between-stretch | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-evenly-baseline | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-evenly-center | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-evenly-flex-end | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-evenly-flex-start | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-nowrap-space-evenly-stretch | flexbox | pass | - | 0.007 | 0.0000 | PASS |
| flex-wrap-center-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-center-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-center-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-center-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-center-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-end-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-end-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-end-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-end-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-end-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-start-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-start-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-start-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-start-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-flex-start-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-center-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-center-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-center-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-center-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-center-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-end-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-end-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-end-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-end-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-end-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-start-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-start-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-start-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-start-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-flex-start-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-around-baseline | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-reverse-space-around-center | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-reverse-space-around-flex-end | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-reverse-space-around-flex-start | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-reverse-space-around-stretch | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-reverse-space-between-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-between-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-between-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-between-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-between-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-evenly-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-evenly-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-evenly-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-evenly-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-reverse-space-evenly-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-around-baseline | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-space-around-center | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-space-around-flex-end | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-space-around-flex-start | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-space-around-stretch | flexbox | pass | - | 0.010 | 0.0000 | PASS |
| flex-wrap-space-between-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-between-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-between-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-between-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-between-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-evenly-baseline | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-evenly-center | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-evenly-flex-end | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-evenly-flex-start | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| flex-wrap-space-evenly-stretch | flexbox | pass | - | 0.000 | 0.0000 | PASS |
| grid-0-100px1fr2fr | grid | pass | - | 0.005 | 0.0000 | PASS |
| grid-0-1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-0-minmax60px1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-0-repeat2301fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-0-repeat280px | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-12px-100px1fr2fr | grid | pass | - | 0.005 | 0.0000 | PASS |
| grid-12px-1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-12px-minmax60px1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-12px-repeat2301fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-12px-repeat280px | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-4px-100px1fr2fr | grid | pass | - | 0.010 | 0.0000 | PASS |
| grid-4px-1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-4px-minmax60px1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-4px-repeat2301fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-4px-repeat280px | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-8px-100px1fr2fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-8px-1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-8px-minmax60px1fr1fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-8px-repeat2301fr | grid | pass | - | 0.000 | 0.0000 | PASS |
| grid-8px-repeat280px | grid | pass | - | 0.000 | 0.0000 | PASS |

## Known Divergences (documented, not silently excluded)

Fixtures whose generator run recorded a divergence carry a typed gap on the diverging layer(s) (`expected.<layer>: { result:"fail", reason, sunset }`) and are listed here. The verify script asserts each still diverges, so a divergence that closes fails the run and must be reclassified into the pass corpus.


