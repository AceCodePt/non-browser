# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T14:31:20.732Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.481 | 1.075 | 6.453 | 14.045 |
| boxes | 0.395 | -3.669 | 6.117 | 8.782 |
| inline-styles | 0.647 | -2.995 | 12.015 | 18.649 |
| replaced-boxes | 0.593 | -5.821 | 4.541 | 10.308 |
| wrapping | 0.367 | 0.959 | 1.905 | 9.699 |

