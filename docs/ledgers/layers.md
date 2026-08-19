# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T04:40:58.438Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.505 | 0.332 | 7.305 | 13.196 |
| boxes | 0.418 | -8.147 | 2.403 | 9.427 |
| inline-styles | 0.593 | 1.086 | 13.26 | 19.548 |
| replaced-boxes | 0.575 | -3.435 | 4.729 | 10.291 |
| wrapping | 0.346 | -3.019 | 0.913 | 7.293 |

