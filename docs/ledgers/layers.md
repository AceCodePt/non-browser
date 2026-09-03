# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T18:01:27.595Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.419 | 0.196 | 3.917 | 5.367 |
| boxes | 0.365 | -0.389 | 3.902 | 4.405 |
| inline-styles | 0.509 | 0.15 | 2.767 | 4.739 |
| replaced-boxes | 0.457 | -0.056 | 4.638 | 5.4 |
| wrapping | 0.313 | 0.213 | 3.912 | 4.548 |

