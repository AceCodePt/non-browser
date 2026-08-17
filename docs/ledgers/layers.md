# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T19:51:45.988Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.62 | -6.746 | 3.014 | 12.851 |
| boxes | 0.398 | -3.661 | 3.59 | 8.99 |
| inline-styles | 0.584 | -3.331 | 8.131 | 17.478 |
| replaced-boxes | 0.539 | 0.053 | 3.667 | 8.877 |
| wrapping | 0.357 | -3.041 | 3.793 | 10.263 |

