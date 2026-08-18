# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T06:08:11.609Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.597 | 1.344 | 8.224 | 18.552 |
| boxes | 0.379 | 0.234 | -0.654 | 10.969 |
| inline-styles | 0.722 | -11.158 | 29.248 | 34.435 |
| replaced-boxes | 0.564 | -5.053 | 6.925 | 13.599 |
| wrapping | 0.505 | -5.777 | -0.905 | 10.945 |

