# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T23:30:26.043Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.457 | -0.389 | 8.177 | 14.792 |
| boxes | 0.383 | 0.244 | 5.952 | 8.316 |
| inline-styles | 0.54 | -6.967 | 11.056 | 18.763 |
| replaced-boxes | 0.433 | -2.502 | 3.792 | 6.14 |
| wrapping | 0.337 | -3.48 | -9.927 | 5.993 |

