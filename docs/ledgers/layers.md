# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T11:44:05.449Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.401 | -0.28 | 4.436 | 5.191 |
| boxes | 0.36 | 0.072 | 3.846 | 4.376 |
| inline-styles | 0.493 | -0.413 | 3.474 | 4.474 |
| replaced-boxes | 0.446 | 0.151 | 3.943 | 5.282 |
| wrapping | 0.313 | 0.197 | 3.843 | 4.511 |

