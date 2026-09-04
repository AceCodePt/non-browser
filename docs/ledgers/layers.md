# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T07:57:38.651Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.406 | 0.216 | 3.992 | 5.296 |
| boxes | 0.368 | 0.106 | 3.877 | 4.452 |
| inline-styles | 0.502 | 0.314 | 2.682 | 4.562 |
| replaced-boxes | 0.453 | 0.127 | 3.822 | 5.285 |
| wrapping | 0.31 | 0.181 | 3.984 | 4.579 |

