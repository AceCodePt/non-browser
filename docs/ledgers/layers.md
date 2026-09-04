# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T05:42:49.180Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.431 | 0.221 | 1.937 | 5.326 |
| boxes | 0.362 | -0.165 | 3.675 | 4.451 |
| inline-styles | 0.482 | 0.353 | 2.724 | 4.424 |
| replaced-boxes | 0.437 | 0.063 | 4.591 | 5.198 |
| wrapping | 0.291 | -0.553 | 3.944 | 4.511 |

