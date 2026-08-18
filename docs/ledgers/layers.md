# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T09:55:12.421Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.577 | 0.493 | 4.446 | 12.821 |
| boxes | 0.392 | -2.721 | 2.752 | 5.127 |
| inline-styles | 0.543 | -2.566 | 9.389 | 20.313 |
| replaced-boxes | 0.644 | -4.458 | 7.335 | 12.091 |
| wrapping | 0.334 | 0.901 | 8.807 | 10.975 |

