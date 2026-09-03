# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T07:48:27.838Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.379 | 0.16 | 4.512 | 5.215 |
| boxes | 0.31 | -0.58 | 3.886 | 4.397 |
| inline-styles | 0.407 | 0.37 | 2.785 | 4.512 |
| replaced-boxes | 0.363 | 0.077 | 4.612 | 5.159 |
| wrapping | 0.264 | -0.741 | 3.987 | 4.547 |

