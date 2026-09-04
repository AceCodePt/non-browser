# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T13:20:32.015Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.424 | -0.388 | 4.552 | 5.283 |
| boxes | 0.371 | 0.001 | 3.392 | 4.447 |
| inline-styles | 0.502 | 0.338 | 3.515 | 4.62 |
| replaced-boxes | 0.466 | 0.101 | 3.784 | 5.313 |
| wrapping | 0.317 | -0.054 | 3.882 | 4.65 |

