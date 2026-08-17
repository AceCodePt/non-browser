# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T07:17:14.175Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.734 | -3.32 | 4.901 | 11.451 |
| boxes | 0.44 | 0.283 | -4.28 | 5.042 |
| inline-styles | 0.67 | -11.482 | 15.242 | 23.83 |
| replaced-boxes | 0.575 | -3.918 | 3.697 | 10.265 |
| wrapping | 0.433 | -5.295 | 1.072 | 7.396 |

