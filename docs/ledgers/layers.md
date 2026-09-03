# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T17:47:26.278Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.355 | 0.255 | 4.538 | 5.209 |
| boxes | 0.327 | 0.1 | 3.824 | 4.354 |
| inline-styles | 0.439 | 0.327 | 3.511 | 4.381 |
| replaced-boxes | 0.381 | 0.164 | 3.765 | 5.168 |
| wrapping | 0.272 | 0.167 | 4.038 | 4.554 |

