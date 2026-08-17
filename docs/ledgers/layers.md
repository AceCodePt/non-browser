# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T20:59:57.345Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.553 | -0.33 | 4.099 | 7.603 |
| boxes | 0.386 | -7.688 | 3.16 | 5.402 |
| inline-styles | 0.538 | -2.751 | 16.313 | 21.05 |
| replaced-boxes | 0.586 | -3.746 | 3.924 | 10.26 |
| wrapping | 0.325 | 0.945 | 0.243 | 7.048 |

