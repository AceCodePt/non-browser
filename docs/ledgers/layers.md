# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T06:53:30.849Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.566 | 113.688 | 0.104 | 162.84 |
| boxes | 0.681 | 18.974 | -31.87 | 30.007 |
| inline-styles | 0.811 | 22.236 | 11.715 | 75.149 |
| replaced-boxes | 0.748 | 6.355 | 5.565 | 21.476 |
| wrapping | 0.39 | 85.269 | -82.389 | 180.184 |

