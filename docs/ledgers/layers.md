# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T02:54:14.103Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.457 | 1.313 | 6.244 | 13.119 |
| boxes | 0.377 | -3.757 | 7.127 | 8.604 |
| inline-styles | 0.623 | -2.558 | 16.597 | 22.466 |
| replaced-boxes | 0.561 | -4.19 | 5.637 | 14.266 |
| wrapping | 0.345 | 0.813 | 3.497 | 9.356 |

