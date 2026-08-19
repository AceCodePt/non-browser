# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T05:14:57.291Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.51 | 1.121 | 9.173 | 13.459 |
| boxes | 0.397 | 0.185 | -0.906 | 8.229 |
| inline-styles | 0.762 | -3.82 | 20.112 | 23.037 |
| replaced-boxes | 0.566 | -3.462 | 4.163 | 9.731 |
| wrapping | 0.376 | 0.932 | 2.75 | 8.633 |

