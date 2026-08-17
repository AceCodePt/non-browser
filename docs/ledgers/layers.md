# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T22:23:53.228Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.705 | -2.768 | 4.679 | 11.71 |
| boxes | 0.41 | -6.545 | -1.11 | 8.065 |
| inline-styles | 0.606 | -3.427 | 9.554 | 18.121 |
| replaced-boxes | 0.774 | -5.169 | 6.887 | 10.417 |
| wrapping | 0.346 | -2.215 | 4.755 | 10.27 |

