# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T18:59:01.701Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.458 | -3.119 | 3.847 | 10.718 |
| boxes | 0.397 | -3.689 | 3.282 | 8.995 |
| inline-styles | 0.594 | -2.882 | 12.873 | 18.725 |
| replaced-boxes | 0.495 | -3.815 | 4.912 | 10.168 |
| wrapping | 0.34 | 0.943 | 0.04 | 6.499 |

