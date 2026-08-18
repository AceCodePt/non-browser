# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T07:16:59.511Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.516 | 1.149 | 5.624 | 15.496 |
| boxes | 0.379 | -3.589 | 2.82 | 8.779 |
| inline-styles | 0.734 | -3.372 | 11.252 | 18.489 |
| replaced-boxes | 0.616 | -2.218 | 4.717 | 11.495 |
| wrapping | 0.339 | 0.808 | 2.646 | 10.189 |

