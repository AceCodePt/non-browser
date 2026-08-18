# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T21:14:38.988Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.458 | -3.429 | -0.274 | 9.831 |
| boxes | 0.403 | 0.225 | 8.017 | 8.862 |
| inline-styles | 0.533 | -5.674 | 15.435 | 21.448 |
| replaced-boxes | 0.485 | -7.201 | 11.002 | 13.341 |
| wrapping | 0.325 | -4.498 | 4.698 | 9.752 |

