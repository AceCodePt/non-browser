# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T11:53:12.331Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.388 | -0.399 | 4.537 | 5.174 |
| boxes | 0.311 | -0.011 | 3.843 | 4.323 |
| inline-styles | 0.431 | 0.276 | 3.461 | 4.38 |
| replaced-boxes | 0.39 | 0.134 | 4.568 | 5.149 |
| wrapping | 0.262 | -0.701 | 4.016 | 4.518 |

