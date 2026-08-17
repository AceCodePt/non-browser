# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T18:09:33.314Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.595 | -3.723 | 3.132 | 14.668 |
| boxes | 0.376 | 0.139 | 4.793 | 8.538 |
| inline-styles | 0.743 | -6.861 | 11.983 | 23.725 |
| replaced-boxes | 0.703 | -1.041 | 8.021 | 12.337 |
| wrapping | 0.33 | 0.908 | 5.115 | 9.958 |

