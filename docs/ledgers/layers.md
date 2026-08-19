# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T06:18:18.562Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.581 | -1.417 | 1.368 | 12.656 |
| boxes | 0.406 | -3.247 | -3.439 | 5.663 |
| inline-styles | 0.6 | 0.644 | 7.826 | 19.914 |
| replaced-boxes | 0.589 | -13.087 | -0.48 | 10.335 |
| wrapping | 0.469 | -6.867 | 2.576 | 10.396 |

