# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T18:25:09.588Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.526 | -6.694 | 3.425 | 11.784 |
| boxes | 0.427 | -3.649 | 4.165 | 8.553 |
| inline-styles | 0.841 | -3.309 | 17.609 | 23.444 |
| replaced-boxes | 0.83 | -6.454 | 3.525 | 10.814 |
| wrapping | 0.39 | -4.492 | 1.581 | 10.089 |

