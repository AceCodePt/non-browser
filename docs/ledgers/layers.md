# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T01:12:18.591Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.518 | -2.704 | 5.362 | 11.337 |
| boxes | 0.412 | -3.692 | 1.122 | 8.811 |
| inline-styles | 0.533 | 1.046 | 14.333 | 20.261 |
| replaced-boxes | 0.521 | -5.007 | 8.05 | 10.487 |
| wrapping | 0.341 | -3.127 | 4.332 | 9.977 |

