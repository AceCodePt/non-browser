# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T16:47:06.382Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.615 | -2.709 | 3.135 | 11.438 |
| boxes | 0.435 | -4.103 | 5.521 | 9.069 |
| inline-styles | 0.595 | -4.218 | 8.971 | 10.974 |
| replaced-boxes | 0.541 | -1.597 | 3.136 | 12.617 |
| wrapping | 0.36 | -9.682 | 5.822 | 10.136 |

