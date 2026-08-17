# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T06:37:00.153Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.615 | -3.336 | 11.134 | 20.62 |
| boxes | 0.628 | -10.546 | 10.303 | 15.313 |
| inline-styles | 0.596 | -9.056 | 18.091 | 34.222 |
| replaced-boxes | 0.765 | -5.273 | 11.054 | 14.795 |
| wrapping | 0.535 | -11.813 | 0.273 | 14.563 |

