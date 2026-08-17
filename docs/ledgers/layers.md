# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T19:17:44.365Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.585 | -10.31 | 1.592 | 11.66 |
| boxes | 0.387 | -3.725 | 2.576 | 7.451 |
| inline-styles | 0.563 | 1.003 | 10.065 | 18.892 |
| replaced-boxes | 0.587 | -1.168 | 2.58 | 12.78 |
| wrapping | 0.321 | -7.207 | 4.528 | 10.804 |

