# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T15:01:22.662Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.534 | -12.603 | 9.355 | 16.46 |
| boxes | 0.397 | -6.857 | 2.179 | 6.976 |
| inline-styles | 0.534 | -4.848 | 11.974 | 18.249 |
| replaced-boxes | 0.465 | -3.323 | 4.479 | 10.212 |
| wrapping | 0.316 | 0.905 | 4.137 | 10.103 |

