# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T00:40:25.709Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.541 | 1.24 | 7.257 | 14.814 |
| boxes | 0.417 | -7.642 | 4.006 | 6.024 |
| inline-styles | 0.575 | -6.843 | 15.941 | 19.967 |
| replaced-boxes | 0.571 | -3.6 | 6.531 | 10.235 |
| wrapping | 0.397 | -6.528 | -2.591 | 9.479 |

