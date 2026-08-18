# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T09:21:13.893Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.443 | -2.258 | 4.024 | 12.17 |
| boxes | 0.376 | -2.171 | 4.076 | 7.84 |
| inline-styles | 0.529 | -6.864 | 13.794 | 18.942 |
| replaced-boxes | 0.556 | -7.408 | 2.833 | 7.28 |
| wrapping | 0.431 | -6.326 | 4.623 | 9.56 |

