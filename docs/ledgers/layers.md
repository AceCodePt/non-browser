# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T06:05:54.728Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.394 | 0.178 | 3.858 | 5.2 |
| boxes | 0.355 | 0.087 | 3.869 | 4.331 |
| inline-styles | 0.504 | 0.257 | 2.787 | 4.439 |
| replaced-boxes | 0.435 | 0.097 | 4.603 | 5.276 |
| wrapping | 0.31 | 0.159 | 3.994 | 4.545 |

