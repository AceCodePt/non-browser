# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T04:23:46.110Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.507 | 1.29 | 2.808 | 11.992 |
| boxes | 0.381 | -4.396 | -0.578 | 5.019 |
| inline-styles | 0.543 | 1.261 | 11.991 | 18.673 |
| replaced-boxes | 0.512 | -9.222 | 7.708 | 12.846 |
| wrapping | 0.471 | -3.536 | -12.628 | 11.415 |

