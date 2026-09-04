# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T11:19:15.073Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.405 | -0.505 | 4.548 | 5.235 |
| boxes | 0.365 | -0.588 | 3.862 | 4.43 |
| inline-styles | 0.507 | 0.35 | 2.879 | 4.497 |
| replaced-boxes | 0.457 | 0.166 | 3.956 | 5.285 |
| wrapping | 0.308 | -0.111 | 3.97 | 4.529 |

