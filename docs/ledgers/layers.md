# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T12:11:20.454Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.454 | 1.251 | 5.123 | 13.273 |
| boxes | 0.403 | -3.655 | 3.481 | 8.465 |
| inline-styles | 0.714 | -6.688 | 11.497 | 20.485 |
| replaced-boxes | 0.646 | -3.939 | 4.608 | 10.225 |
| wrapping | 0.324 | -2.097 | 4.425 | 10.26 |

