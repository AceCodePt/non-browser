# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T23:50:35.155Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.565 | -2.377 | 7.109 | 15.288 |
| boxes | 0.458 | -3.565 | 4.141 | 5.377 |
| inline-styles | 0.703 | -1.031 | 14.089 | 21.506 |
| replaced-boxes | 0.651 | -7.789 | 9.607 | 12.47 |
| wrapping | 0.342 | -3.002 | 3.24 | 8.107 |

