# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T15:52:15.002Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.418 | -7.457 | 0.953 | 5.419 |
| boxes | 0.378 | 0.033 | 2.209 | 4.572 |
| inline-styles | 0.497 | -1.293 | -0.437 | 4.552 |
| replaced-boxes | 0.401 | 0.05 | 4.705 | 5.302 |
| wrapping | 0.277 | 0.031 | 4.006 | 4.517 |

