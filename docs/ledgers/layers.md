# Layers Ledger — selective render entry functions

- Generated: 2026-08-31T18:40:34.284Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.433 | 0.588 | 3.471 | 5.779 |
| boxes | 0.39 | 0.261 | 3.863 | 4.663 |
| inline-styles | 0.489 | 0.593 | 4.004 | 5.26 |
| replaced-boxes | 0.447 | -0.526 | 4.629 | 5.667 |
| wrapping | 0.329 | 0.458 | 3.816 | 4.907 |

