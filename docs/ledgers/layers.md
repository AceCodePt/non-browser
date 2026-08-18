# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T12:49:29.092Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.525 | 1.564 | 4.493 | 11.424 |
| boxes | 0.435 | -3.514 | 2.691 | 6.96 |
| inline-styles | 0.835 | -2.778 | 3.878 | 22.078 |
| replaced-boxes | 0.621 | -4.452 | 1.822 | 10.445 |
| wrapping | 0.382 | 0.821 | 4.819 | 9.451 |

