# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T04:07:00.453Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.523 | -3.312 | 2.343 | 11.349 |
| boxes | 0.409 | -0.203 | -3.613 | 5.236 |
| inline-styles | 0.666 | -2.517 | 15.105 | 21.107 |
| replaced-boxes | 0.636 | -3.178 | 7.442 | 10.114 |
| wrapping | 0.349 | -1.835 | 4.751 | 10.123 |

