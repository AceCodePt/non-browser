# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T08:25:42.650Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.646 | 1.22 | 5.339 | 12.125 |
| boxes | 0.439 | -11.514 | 3.028 | 6.338 |
| inline-styles | 0.57 | -10.677 | 17.357 | 23.988 |
| replaced-boxes | 0.559 | -7.461 | 2.893 | 14.384 |
| wrapping | 0.341 | -6.527 | -10.754 | 6.997 |

