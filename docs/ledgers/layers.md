# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T20:25:51.203Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.577 | -6.143 | 3.924 | 10.93 |
| boxes | 0.387 | -3.634 | 5.075 | 9.066 |
| inline-styles | 0.75 | -12.485 | 13.109 | 23.198 |
| replaced-boxes | 0.741 | -0.116 | 4.721 | 14.304 |
| wrapping | 0.341 | -5.655 | -3.186 | 10.273 |

