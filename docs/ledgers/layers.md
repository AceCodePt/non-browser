# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T05:33:03.992Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.617 | -10.405 | 5.162 | 15.393 |
| boxes | 0.413 | -8.344 | -6.932 | 10.157 |
| inline-styles | 0.554 | -10.726 | 14.657 | 27.032 |
| replaced-boxes | 0.612 | -10.545 | 4.682 | 10.392 |
| wrapping | 0.332 | -11.047 | 1.936 | 10.142 |

