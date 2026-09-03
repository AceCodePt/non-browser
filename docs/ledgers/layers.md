# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T13:04:42.719Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.379 | 0.197 | 4.45 | 5.217 |
| boxes | 0.324 | 0.083 | 3.823 | 4.322 |
| inline-styles | 0.428 | 0.316 | 3.532 | 4.399 |
| replaced-boxes | 0.393 | 0.094 | 3.764 | 5.172 |
| wrapping | 0.272 | 0.107 | 3.907 | 4.474 |

