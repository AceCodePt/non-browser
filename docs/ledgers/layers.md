# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T05:38:16.677Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.41 | 0.226 | 3.982 | 5.241 |
| boxes | 0.353 | -3.181 | 3.763 | 4.393 |
| inline-styles | 0.508 | 0.303 | 3.486 | 4.477 |
| replaced-boxes | 0.439 | 0.115 | 4.418 | 5.288 |
| wrapping | 0.295 | 0.201 | 3.976 | 4.563 |

