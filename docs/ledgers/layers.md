# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T06:23:12.603Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.484 | -4.044 | 3.917 | 12.052 |
| boxes | 0.426 | -3.677 | 1.072 | 6.307 |
| inline-styles | 0.611 | -3.407 | -16.823 | 24.234 |
| replaced-boxes | 0.571 | -4.736 | 0.095 | 10.375 |
| wrapping | 0.372 | -3.084 | 9.899 | 11.388 |

