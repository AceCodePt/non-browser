# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T09:57:13.367Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.373 | 0.234 | 4.566 | 5.297 |
| boxes | 0.3 | 0.103 | 3.885 | 4.314 |
| inline-styles | 0.416 | 0.311 | 2.841 | 4.451 |
| replaced-boxes | 0.367 | 0.138 | 4.433 | 5.213 |
| wrapping | 0.288 | 0.109 | 4.01 | 4.535 |

