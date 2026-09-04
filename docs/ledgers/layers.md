# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T13:24:01.461Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.402 | -0.429 | 4.495 | 5.22 |
| boxes | 0.357 | 0.095 | 3.883 | 4.379 |
| inline-styles | 0.497 | 0.358 | 3.427 | 4.475 |
| replaced-boxes | 0.452 | -0.642 | 4.639 | 5.284 |
| wrapping | 0.298 | 0.21 | 3.967 | 4.592 |

