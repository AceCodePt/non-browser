# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T17:13:30.153Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.405 | -0.941 | 4.612 | 5.355 |
| boxes | 0.353 | -0.046 | 3.923 | 4.554 |
| inline-styles | 0.456 | -0.477 | 3.464 | 4.488 |
| replaced-boxes | 0.4 | 0.139 | 4.658 | 5.294 |
| wrapping | 0.281 | 0.198 | 3.939 | 4.606 |

