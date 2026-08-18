# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T02:07:11.215Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.666 | 0.577 | 8.148 | 15.718 |
| boxes | 0.408 | -11.258 | 4.524 | 5.492 |
| inline-styles | 0.538 | -2.862 | 12.911 | 19.404 |
| replaced-boxes | 0.578 | -4.655 | 6.118 | 11.889 |
| wrapping | 0.317 | 0.807 | 3.731 | 10.196 |

