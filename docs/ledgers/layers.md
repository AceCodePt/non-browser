# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T13:53:00.180Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.47 | -8.052 | 7.877 | 14.237 |
| boxes | 0.389 | -3.777 | 4.162 | 8.81 |
| inline-styles | 0.546 | 0.993 | 13.131 | 19.108 |
| replaced-boxes | 0.539 | -2.527 | 5.11 | 10.258 |
| wrapping | 0.346 | -4.744 | 2.154 | 8.327 |

