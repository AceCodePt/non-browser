# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T04:02:06.543Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.464 | -3.869 | 10.622 | 15.231 |
| boxes | 0.39 | -3.721 | 0.231 | 6.243 |
| inline-styles | 0.526 | -3.923 | 9.32 | 17.538 |
| replaced-boxes | 0.611 | -3.87 | 5.982 | 11.114 |
| wrapping | 0.325 | -1.591 | 4.724 | 10.093 |

