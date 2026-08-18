# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T08:05:49.256Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.719 | -4.12 | 7.088 | 15.402 |
| boxes | 0.432 | -3.704 | 1.638 | 6.501 |
| inline-styles | 0.79 | -4.088 | 13.866 | 19.565 |
| replaced-boxes | 0.61 | 0.093 | 4.932 | 10.334 |
| wrapping | 0.369 | -3.053 | 6.291 | 9.081 |

