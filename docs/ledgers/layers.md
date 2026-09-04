# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T06:26:27.957Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.41 | 0.286 | 3.831 | 5.286 |
| boxes | 0.379 | 0.108 | 3.838 | 4.421 |
| inline-styles | 0.528 | 0.284 | 2.914 | 4.526 |
| replaced-boxes | 0.464 | -0.561 | 4.542 | 5.311 |
| wrapping | 0.313 | 0.146 | 3.94 | 4.558 |

