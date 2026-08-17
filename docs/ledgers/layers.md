# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T17:01:16.278Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.554 | -0.389 | 1.286 | 10.829 |
| boxes | 0.376 | -10.149 | 2.08 | 6.796 |
| inline-styles | 0.531 | -6.666 | 15.146 | 19.258 |
| replaced-boxes | 0.542 | -8.445 | 0.913 | 10.297 |
| wrapping | 0.492 | -7.027 | 0.946 | 11.046 |

