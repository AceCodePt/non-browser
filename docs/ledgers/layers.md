# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T00:08:51.348Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.515 | -6.247 | 5.989 | 12.159 |
| boxes | 0.462 | -3.708 | 4.119 | 5.25 |
| inline-styles | 0.8 | -7.533 | 14.547 | 21.489 |
| replaced-boxes | 0.64 | -3.047 | 3.388 | 10.312 |
| wrapping | 0.387 | 0.875 | -2.717 | 6.401 |

