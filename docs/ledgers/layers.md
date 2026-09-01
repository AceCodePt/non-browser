# Layers Ledger — selective render entry functions

- Generated: 2026-09-01T04:47:07.880Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.468 | 0.685 | 3.702 | 5.767 |
| boxes | 0.405 | 0.217 | 3.914 | 4.755 |
| inline-styles | 0.531 | 0.464 | 3.508 | 5.319 |
| replaced-boxes | 0.476 | 0.375 | 4.409 | 5.604 |
| wrapping | 0.349 | 0.434 | 2.955 | 4.957 |

