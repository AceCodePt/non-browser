# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T07:31:31.499Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.502 | 1.218 | 5.338 | 11.239 |
| boxes | 0.454 | -7.463 | -5.736 | 5.137 |
| inline-styles | 0.7 | -2.102 | 14.908 | 20.894 |
| replaced-boxes | 0.571 | -6.366 | 2.234 | 10.433 |
| wrapping | 0.347 | -2.787 | 0.735 | 10.128 |

