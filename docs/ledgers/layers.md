# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T07:32:56.772Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.375 | 0.172 | 3.881 | 5.223 |
| boxes | 0.342 | 0.09 | 3.796 | 4.334 |
| inline-styles | 0.47 | 0.328 | 2.943 | 4.442 |
| replaced-boxes | 0.426 | 0.15 | 3.799 | 5.24 |
| wrapping | 0.287 | 0.073 | 3.924 | 4.558 |

