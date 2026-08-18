# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T11:03:18.853Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.575 | -2.644 | 1.779 | 10.452 |
| boxes | 0.382 | -2.596 | 1.433 | 8.573 |
| inline-styles | 0.549 | -2.89 | 10.002 | 19.032 |
| replaced-boxes | 0.62 | -2.237 | 7.871 | 10.288 |
| wrapping | 0.466 | -4.178 | 3.385 | 10.226 |

