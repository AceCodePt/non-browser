# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T06:52:27.866Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.516 | -13.227 | 5.261 | 11.188 |
| boxes | 0.387 | -15.495 | 3.915 | 5.036 |
| inline-styles | 0.69 | -6.793 | 12.303 | 18.188 |
| replaced-boxes | 0.674 | -6.096 | 9.275 | 13.39 |
| wrapping | 0.31 | -5.625 | 3.392 | 10.186 |

