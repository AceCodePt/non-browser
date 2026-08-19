# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T01:16:57.074Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.552 | -1.958 | 3.242 | 10.482 |
| boxes | 0.407 | -10.712 | 4.137 | 9 |
| inline-styles | 0.604 | -2.135 | 12.406 | 21.88 |
| replaced-boxes | 0.507 | -2.018 | 1.865 | 9.395 |
| wrapping | 0.375 | 0.95 | 3.601 | 10.337 |

