# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T16:24:25.909Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.564 | -0.722 | 3.967 | 5.56 |
| boxes | 0.407 | -0.086 | 1.625 | 4.69 |
| inline-styles | 0.531 | 0.027 | 1.978 | 4.663 |
| replaced-boxes | 0.463 | 0.142 | 4.677 | 5.506 |
| wrapping | 0.321 | -0.466 | 0.793 | 5.104 |

