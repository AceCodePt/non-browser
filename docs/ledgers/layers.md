# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T05:54:55.522Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.41 | 0.219 | 3.857 | 5.299 |
| boxes | 0.375 | 0.057 | 3.804 | 4.412 |
| inline-styles | 0.525 | 0.323 | 3.552 | 4.482 |
| replaced-boxes | 0.458 | 0.165 | 4.523 | 5.359 |
| wrapping | 0.306 | 0.145 | 3.97 | 4.554 |

