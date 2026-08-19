# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T03:28:12.468Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.463 | -2.748 | 5.409 | 11.117 |
| boxes | 0.392 | -3.697 | 4.447 | 8.869 |
| inline-styles | 0.529 | 1.008 | 16.58 | 23.256 |
| replaced-boxes | 0.475 | -4.42 | 4.764 | 10.227 |
| wrapping | 0.337 | -3.021 | 4.697 | 10.007 |

