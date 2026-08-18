# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T16:43:08.266Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.663 | -6.652 | 9.329 | 11.23 |
| boxes | 0.38 | -3.996 | 2.18 | 7.41 |
| inline-styles | 0.602 | -2.892 | 15.485 | 21.631 |
| replaced-boxes | 0.631 | -7.303 | 7.54 | 9.118 |
| wrapping | 0.329 | 0.912 | 3.528 | 10.868 |

