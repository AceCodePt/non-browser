# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T03:15:33.392Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.6 | 1.096 | -2.966 | 12.214 |
| boxes | 0.378 | -3.751 | -2.613 | 5.366 |
| inline-styles | 0.597 | -6.89 | 17.573 | 23.709 |
| replaced-boxes | 0.616 | -1.629 | 3.655 | 10.265 |
| wrapping | 0.316 | -1.966 | -1.372 | 6.576 |

