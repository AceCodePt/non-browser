# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T16:42:13.701Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.743 | -6.594 | 8.406 | 15.159 |
| boxes | 0.413 | -2.062 | 1.761 | 6.73 |
| inline-styles | 0.725 | -2.922 | 14.259 | 20.511 |
| replaced-boxes | 0.667 | -3.503 | 2.193 | 7.521 |
| wrapping | 0.404 | -2.959 | 6.233 | 12.936 |

