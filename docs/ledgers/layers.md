# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T05:10:08.135Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.446 | 1.253 | 3.058 | 7.209 |
| boxes | 0.385 | -3.782 | 4.235 | 4.978 |
| inline-styles | 0.529 | 1.031 | 10.314 | 20.846 |
| replaced-boxes | 0.465 | -1.472 | 7.429 | 10.286 |
| wrapping | 0.32 | -2.985 | 4.739 | 9.972 |

