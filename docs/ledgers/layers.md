# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T09:17:42.427Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.388 | -0.491 | 4.472 | 5.247 |
| boxes | 0.355 | -0.552 | 3.873 | 4.332 |
| inline-styles | 0.488 | 0.332 | 3 | 4.447 |
| replaced-boxes | 0.438 | 0.149 | 4.038 | 5.24 |
| wrapping | 0.292 | 0.118 | 3.952 | 4.511 |

