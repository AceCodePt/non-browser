# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T07:44:06.889Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.394 | -0.634 | 4.18 | 5.189 |
| boxes | 0.349 | 0.03 | 3.843 | 4.353 |
| inline-styles | 0.49 | 0.351 | 3.109 | 4.466 |
| replaced-boxes | 0.443 | 0.108 | 3.924 | 5.273 |
| wrapping | 0.298 | 0.183 | 3.906 | 4.506 |

