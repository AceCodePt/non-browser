# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T18:59:17.750Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.498 | -2.357 | 2.292 | 10.41 |
| boxes | 0.429 | -3.727 | -0.157 | 5.694 |
| inline-styles | 0.642 | -2.797 | 16.408 | 21.845 |
| replaced-boxes | 0.582 | -8.685 | 1.444 | 9.078 |
| wrapping | 0.359 | -2.922 | 3.495 | 9.084 |

