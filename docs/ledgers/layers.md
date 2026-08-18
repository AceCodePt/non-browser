# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T11:37:18.665Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.516 | -4.215 | 2.365 | 11.598 |
| boxes | 0.415 | 0.291 | 4.226 | 7.883 |
| inline-styles | 0.609 | -1.507 | 12.709 | 18.669 |
| replaced-boxes | 0.525 | -0.146 | 3.56 | 9.897 |
| wrapping | 0.343 | -2.952 | 3.512 | 10.236 |

