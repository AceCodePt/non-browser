# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T22:22:34.403Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.456 | -2.751 | 3.882 | 11.16 |
| boxes | 0.398 | -3.695 | 4.102 | 8.901 |
| inline-styles | 0.53 | -11.605 | 12.316 | 18.684 |
| replaced-boxes | 0.516 | -3.37 | 1.738 | 10.126 |
| wrapping | 0.332 | -5.663 | 2.244 | 10.201 |

