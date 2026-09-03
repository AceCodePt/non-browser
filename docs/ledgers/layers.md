# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T11:43:23.059Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.39 | 0.201 | 4.564 | 5.307 |
| boxes | 0.324 | 0.067 | 3.892 | 4.331 |
| inline-styles | 0.43 | 0.274 | 2.815 | 4.445 |
| replaced-boxes | 0.378 | 0.091 | 4.56 | 5.186 |
| wrapping | 0.269 | 0.186 | 3.19 | 4.515 |

