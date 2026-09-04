# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T13:33:59.181Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.394 | -0.431 | 4.519 | 5.267 |
| boxes | 0.363 | -0.53 | 3.923 | 4.426 |
| inline-styles | 0.5 | 0.365 | 3.038 | 4.494 |
| replaced-boxes | 0.453 | 0.16 | 3.99 | 5.246 |
| wrapping | 0.308 | 0.069 | 4.003 | 4.559 |

