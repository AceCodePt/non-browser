# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T17:43:44.396Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.379 | 0.253 | 3.986 | 5.336 |
| boxes | 0.341 | 0.099 | 3.402 | 4.401 |
| inline-styles | 0.466 | 0.22 | 2.708 | 4.502 |
| replaced-boxes | 0.42 | 0.075 | 4.027 | 5.273 |
| wrapping | 0.29 | 0.151 | 3.985 | 4.556 |

