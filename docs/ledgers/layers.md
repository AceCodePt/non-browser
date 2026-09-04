# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T13:37:38.082Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.392 | 0.004 | 3.754 | 5.226 |
| boxes | 0.345 | 0.102 | 3.921 | 4.375 |
| inline-styles | 0.488 | 0.312 | 3.541 | 4.499 |
| replaced-boxes | 0.433 | 0.117 | 3.868 | 5.227 |
| wrapping | 0.286 | 0.222 | 3.988 | 4.532 |

