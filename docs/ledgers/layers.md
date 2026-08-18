# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T11:41:24.824Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.601 | -2.528 | 3.56 | 12.543 |
| boxes | 0.448 | -7.903 | 1.653 | 6.706 |
| inline-styles | 0.625 | -2.727 | 11.193 | 19.326 |
| replaced-boxes | 0.612 | -7.378 | 4.872 | 10.377 |
| wrapping | 0.38 | -3.1 | 3.513 | 10.639 |

