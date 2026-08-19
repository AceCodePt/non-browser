# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T08:00:41.512Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.468 | -4.265 | 8.849 | 15.394 |
| boxes | 0.461 | -6.184 | 4.135 | 9.099 |
| inline-styles | 0.53 | -5.851 | 19.76 | 23.172 |
| replaced-boxes | 0.601 | -4.202 | 6.726 | 12.875 |
| wrapping | 0.327 | -3.923 | 3.128 | 9.408 |

