# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T09:00:03.370Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.401 | 0.119 | 4.557 | 5.285 |
| boxes | 0.367 | -1.272 | 3.982 | 4.487 |
| inline-styles | 0.497 | 0.015 | 2.886 | 4.572 |
| replaced-boxes | 0.439 | 0.083 | 4.64 | 5.321 |
| wrapping | 0.321 | 0.084 | 1.274 | 4.609 |

