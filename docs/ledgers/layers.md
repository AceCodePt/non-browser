# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T15:05:18.777Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.654 | -2.171 | 7.441 | 15.415 |
| boxes | 0.488 | -8.109 | 4.073 | 9.004 |
| inline-styles | 0.718 | -2.936 | 10.457 | 18.535 |
| replaced-boxes | 0.608 | -3.557 | 4.943 | 10.758 |
| wrapping | 0.474 | -5.284 | 3.302 | 10.668 |

