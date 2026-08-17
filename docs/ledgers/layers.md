# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T16:07:52.511Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.553 | -4.488 | -0.2 | 11.475 |
| boxes | 0.422 | -3.728 | 0.075 | 5.125 |
| inline-styles | 0.854 | -6.138 | 5.236 | 15.401 |
| replaced-boxes | 0.645 | -3.855 | -1.249 | 10.568 |
| wrapping | 0.387 | -2.985 | 7.167 | 10.324 |

