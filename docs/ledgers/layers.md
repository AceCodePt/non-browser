# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T09:13:58.790Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.399 | -0.59 | 4.609 | 5.322 |
| boxes | 0.36 | 0.091 | 3.194 | 4.402 |
| inline-styles | 0.527 | -0.361 | 3.505 | 4.571 |
| replaced-boxes | 0.46 | 0.069 | 3.821 | 5.354 |
| wrapping | 0.299 | 0.122 | 3.907 | 4.57 |

