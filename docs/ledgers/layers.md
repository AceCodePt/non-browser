# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T07:11:56.217Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.676 | -2.901 | 4.61 | 18.427 |
| boxes | 0.441 | -12.485 | 12.267 | 15.209 |
| inline-styles | 0.823 | -3.257 | 18.937 | 22.476 |
| replaced-boxes | 0.763 | -2.306 | 9.008 | 11.961 |
| wrapping | 0.407 | -6.881 | 4.237 | 9.349 |

