# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T10:33:25.076Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.709 | 1.196 | 2.679 | 11.139 |
| boxes | 0.507 | -3.828 | 6.099 | 9.087 |
| inline-styles | 0.693 | 0.984 | 15.942 | 22.108 |
| replaced-boxes | 0.712 | -7.187 | 4.429 | 10.403 |
| wrapping | 0.378 | -9.282 | 4.569 | 10.292 |

