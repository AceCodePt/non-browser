# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T15:35:19.184Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.679 | -16.109 | 1.479 | 11.785 |
| boxes | 0.455 | -5.927 | -1.708 | 8.123 |
| inline-styles | 0.701 | -1.603 | 13.554 | 18.677 |
| replaced-boxes | 0.681 | -7.049 | 8.622 | 12.986 |
| wrapping | 0.406 | -1.37 | 4.635 | 10.379 |

