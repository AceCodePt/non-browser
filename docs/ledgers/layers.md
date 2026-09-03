# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T17:35:51.802Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.44 | 0.214 | 4.645 | 5.415 |
| boxes | 0.399 | 0.007 | 3.358 | 4.505 |
| inline-styles | 0.525 | 0.141 | 2.382 | 4.617 |
| replaced-boxes | 0.479 | -0.682 | 4.677 | 5.381 |
| wrapping | 0.321 | -2.124 | 4.027 | 4.593 |

