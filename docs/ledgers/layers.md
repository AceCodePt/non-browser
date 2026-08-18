# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T02:22:59.417Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.563 | -1.881 | 4.781 | 13.822 |
| boxes | 0.439 | 0.287 | 2.346 | 9.024 |
| inline-styles | 0.888 | -2.849 | 16.368 | 20.252 |
| replaced-boxes | 0.853 | -2.514 | 7.391 | 12.957 |
| wrapping | 0.398 | -3.039 | 4.966 | 10.021 |

