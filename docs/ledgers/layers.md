# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T18:29:24.199Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.497 | -0.635 | 3.171 | 11.043 |
| boxes | 0.411 | -3.668 | 4.172 | 9.033 |
| inline-styles | 0.589 | -2.878 | 11.246 | 18.295 |
| replaced-boxes | 0.493 | -5.284 | 4.168 | 10.389 |
| wrapping | 0.354 | -6.084 | 3.931 | 10.181 |

