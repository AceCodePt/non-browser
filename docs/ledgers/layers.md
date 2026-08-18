# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T23:34:55.332Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.609 | -6.681 | 5.28 | 11.374 |
| boxes | 0.416 | -3.654 | 0.861 | 5.233 |
| inline-styles | 0.802 | -16.987 | 13.67 | 19.735 |
| replaced-boxes | 0.678 | -3.39 | 4.892 | 10.357 |
| wrapping | 0.349 | -0.301 | 4.148 | 10.427 |

