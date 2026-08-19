# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T04:36:04.162Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.462 | -10.363 | 8.604 | 15.334 |
| boxes | 0.382 | 0.312 | 2.741 | 8.265 |
| inline-styles | 0.553 | -2.797 | 17.77 | 23.393 |
| replaced-boxes | 0.537 | -2.504 | 8.425 | 12.661 |
| wrapping | 0.318 | -2.941 | 4.758 | 6.084 |

