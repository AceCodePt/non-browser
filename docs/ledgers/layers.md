# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T22:58:00.625Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.584 | 1.18 | 1.183 | 10.697 |
| boxes | 0.416 | -2.122 | 2.526 | 7.47 |
| inline-styles | 0.587 | -2.817 | 13.209 | 19.295 |
| replaced-boxes | 0.503 | -5.213 | 7.54 | 9.301 |
| wrapping | 0.374 | 0.935 | 3.997 | 9.703 |

