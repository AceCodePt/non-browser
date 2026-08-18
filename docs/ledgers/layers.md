# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T05:49:05.527Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.543 | -2.74 | 6.913 | 13.302 |
| boxes | 0.46 | 0.142 | 3.967 | 5.802 |
| inline-styles | 0.741 | -3.029 | 14.233 | 20.004 |
| replaced-boxes | 0.748 | -5.18 | 5.801 | 9.296 |
| wrapping | 0.383 | -2.827 | 9.899 | 12.963 |

