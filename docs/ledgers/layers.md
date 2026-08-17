# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T05:38:15.601Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.738 | 99.309 | -47.907 | 120.694 |
| boxes | 0.538 | 26.969 | 4.239 | 43.203 |
| inline-styles | 0.823 | 41.72 | 10.776 | 71.809 |
| replaced-boxes | 0.565 | 0.687 | 6.381 | 26.987 |
| wrapping | 0.421 | 129.624 | 6.668 | 150.143 |

