# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T19:33:19.951Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.53 | -3.31 | 0.276 | 10.308 |
| boxes | 0.434 | 0.252 | 4.515 | 9.236 |
| inline-styles | 0.609 | -10.443 | 11.832 | 18.026 |
| replaced-boxes | 0.683 | -4.884 | 1.603 | 7.098 |
| wrapping | 0.363 | -2.276 | 0.73 | 7.264 |

