# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T01:51:01.545Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.541 | -2.864 | 2.267 | 13.098 |
| boxes | 0.417 | -3.69 | 5.542 | 8.876 |
| inline-styles | 0.825 | -16.927 | 13.535 | 22.126 |
| replaced-boxes | 0.676 | -9.733 | 5.097 | 10.485 |
| wrapping | 0.382 | -7.126 | 0.155 | 9.585 |

