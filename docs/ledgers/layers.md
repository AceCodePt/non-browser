# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T07:00:09.168Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.615 | -6.479 | -1.495 | 17.667 |
| boxes | 0.676 | -3.792 | 5.962 | 9.265 |
| inline-styles | 0.607 | -6.524 | 32.354 | 35.516 |
| replaced-boxes | 0.627 | -5.869 | 9.888 | 15.439 |
| wrapping | 0.344 | -18.28 | 6.878 | 11.36 |

