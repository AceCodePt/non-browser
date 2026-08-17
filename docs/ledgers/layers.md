# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T22:08:11.602Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.573 | -7.156 | 3.616 | 12.955 |
| boxes | 0.401 | -9.935 | 4.296 | 9.087 |
| inline-styles | 0.551 | -3.514 | 13.326 | 19.187 |
| replaced-boxes | 0.551 | -4.187 | 7.156 | 10.231 |
| wrapping | 0.338 | -8.563 | 3.069 | 9.937 |

