# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T13:30:37.293Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.406 | 0.266 | 4.112 | 5.287 |
| boxes | 0.351 | 0.07 | 3.789 | 4.353 |
| inline-styles | 0.513 | 0.32 | 3.557 | 4.441 |
| replaced-boxes | 0.445 | 0.04 | 4.67 | 5.297 |
| wrapping | 0.302 | 0.17 | 3.99 | 4.556 |

