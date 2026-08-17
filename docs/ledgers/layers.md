# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T23:16:24.805Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.634 | -2.854 | -1.085 | 11.103 |
| boxes | 0.462 | -2.486 | 6.98 | 9.063 |
| inline-styles | 0.611 | 0.318 | 11.252 | 18.112 |
| replaced-boxes | 0.536 | 0.507 | 5.04 | 10.304 |
| wrapping | 0.336 | -3.126 | 3.467 | 8.92 |

