# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T16:29:19.642Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.451 | 0.156 | 4.603 | 5.43 |
| boxes | 0.352 | 0.048 | 3.34 | 4.495 |
| inline-styles | 0.504 | 0.171 | 3.56 | 4.544 |
| replaced-boxes | 0.456 | -0.772 | 4.708 | 5.478 |
| wrapping | 0.301 | 0.087 | 3.433 | 4.624 |

