# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T00:42:55.017Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.497 | -1.795 | 4.876 | 13.356 |
| boxes | 0.414 | -5.334 | 7.236 | 8.004 |
| inline-styles | 0.664 | -3.391 | 9.804 | 19.658 |
| replaced-boxes | 0.599 | 0.267 | 4.998 | 9.068 |
| wrapping | 0.362 | -1.391 | 7.566 | 10.273 |

