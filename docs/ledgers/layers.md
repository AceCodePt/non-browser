# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T21:53:04.058Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.482 | -2.229 | 3.524 | 10.25 |
| boxes | 0.408 | 0.2 | 5.615 | 8.991 |
| inline-styles | 0.604 | -3.562 | 9.552 | 18.542 |
| replaced-boxes | 0.654 | -7.891 | 7.982 | 10.902 |
| wrapping | 0.378 | -3.063 | 4.418 | 9.924 |

