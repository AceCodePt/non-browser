# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T07:03:55.344Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.726 | -15.129 | -1.017 | 17.355 |
| boxes | 0.432 | 0.235 | -2.457 | 8.169 |
| inline-styles | 0.904 | -10.766 | 18.094 | 33 |
| replaced-boxes | 0.612 | -10.069 | -2.087 | 18.266 |
| wrapping | 0.596 | -7.751 | 2.913 | 15.104 |

