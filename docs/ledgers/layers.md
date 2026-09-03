# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T15:50:03.796Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.482 | -0.38 | 4.894 | 6.458 |
| boxes | 0.358 | 0.114 | 3.315 | 4.686 |
| inline-styles | 0.481 | 0.062 | 2.169 | 4.9 |
| replaced-boxes | 0.423 | -1.897 | 4.515 | 5.535 |
| wrapping | 0.299 | 0.008 | 4.188 | 4.904 |

