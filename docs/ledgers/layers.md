# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T02:22:48.164Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.606 | 82.688 | -31.479 | 94.573 |
| boxes | 0.555 | 16.508 | 5.955 | 26.987 |
| inline-styles | 0.655 | 16.43 | 17.431 | 41.475 |
| replaced-boxes | 0.648 | 6.099 | -2.99 | 20.241 |
| wrapping | 0.397 | 112.024 | -33.309 | 133.863 |

