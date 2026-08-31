# Layers Ledger — selective render entry functions

- Generated: 2026-08-31T18:37:58.810Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.46 | 0.658 | 3.477 | 5.769 |
| boxes | 0.39 | 0.261 | 3.849 | 4.697 |
| inline-styles | 0.518 | -0.224 | 3.934 | 5.347 |
| replaced-boxes | 0.462 | 0.349 | 1.52 | 5.721 |
| wrapping | 0.344 | 0.473 | 2.978 | 4.939 |

