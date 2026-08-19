# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T03:33:02.749Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.482 | -3.816 | 0.843 | 7.235 |
| boxes | 0.404 | -1.011 | 4.07 | 8.967 |
| inline-styles | 0.823 | -2.869 | 5.749 | 11.198 |
| replaced-boxes | 0.646 | -3.387 | 5.007 | 10.461 |
| wrapping | 0.406 | -5.563 | 4.005 | 10.181 |

