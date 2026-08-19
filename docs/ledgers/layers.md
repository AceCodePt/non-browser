# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T00:04:19.086Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.485 | -2.751 | 4.072 | 14.744 |
| boxes | 0.378 | 0.278 | 4.115 | 8.9 |
| inline-styles | 0.558 | -6.878 | 11.101 | 20.227 |
| replaced-boxes | 0.547 | -4.111 | 3.26 | 8.563 |
| wrapping | 0.326 | -7.048 | -0.401 | 6.311 |

