# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T19:32:56.315Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.469 | 1.192 | 4.812 | 12.371 |
| boxes | 0.387 | -10.546 | 4.216 | 8.952 |
| inline-styles | 0.564 | -6.81 | 13.868 | 19.67 |
| replaced-boxes | 0.539 | -3.114 | 5.263 | 11.43 |
| wrapping | 0.462 | -3.034 | 4.737 | 10.362 |

