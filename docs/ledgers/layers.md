# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T08:53:13.697Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.402 | 0.258 | 4.524 | 5.226 |
| boxes | 0.361 | 0.104 | 3.475 | 4.419 |
| inline-styles | 0.504 | 0.276 | 3.499 | 4.504 |
| replaced-boxes | 0.447 | -0.742 | 4.585 | 5.282 |
| wrapping | 0.305 | 0.198 | 3.975 | 4.563 |

