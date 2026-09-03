# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T09:09:41.520Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.385 | 0.261 | 1.982 | 5.27 |
| boxes | 0.306 | 0.061 | 3.854 | 4.298 |
| inline-styles | 0.42 | 0.385 | 3.079 | 4.42 |
| replaced-boxes | 0.374 | 0.169 | 4.541 | 5.248 |
| wrapping | 0.261 | 0.197 | 4.048 | 4.59 |

