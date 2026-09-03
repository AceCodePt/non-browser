# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T08:38:12.018Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.346 | 0.245 | 3.394 | 5.245 |
| boxes | 0.307 | 0.075 | 3.736 | 4.343 |
| inline-styles | 0.41 | 0.371 | 3.369 | 4.374 |
| replaced-boxes | 0.366 | 0.034 | 3.591 | 5.213 |
| wrapping | 0.26 | -0.773 | 3.994 | 4.521 |

