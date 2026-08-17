# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T12:57:38.409Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.481 | -14.703 | 6.962 | 18.141 |
| boxes | 0.554 | -3.838 | -3.625 | 11.772 |
| inline-styles | 0.606 | -3.497 | 17.217 | 29.994 |
| replaced-boxes | 0.518 | -5.653 | 1.542 | 10.317 |
| wrapping | 0.351 | -3.007 | -0.236 | 13.293 |

