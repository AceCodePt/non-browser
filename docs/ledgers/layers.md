# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T06:42:46.852Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.642 | -5.287 | 6.722 | 13.285 |
| boxes | 0.386 | -1.507 | 3.012 | 8.093 |
| inline-styles | 0.528 | -2.966 | 12.321 | 20.404 |
| replaced-boxes | 0.515 | -17.939 | 4.902 | 12.068 |
| wrapping | 0.337 | -2.761 | 4.598 | 10.155 |

