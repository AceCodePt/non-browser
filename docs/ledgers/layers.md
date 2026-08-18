# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T12:45:18.405Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.591 | -0.298 | 3.261 | 11.752 |
| boxes | 0.394 | -3.723 | 3.93 | 9.057 |
| inline-styles | 0.555 | -6.917 | 9.127 | 11.131 |
| replaced-boxes | 0.564 | -6.466 | 3.946 | 10.295 |
| wrapping | 0.342 | 0.868 | 4.611 | 10.315 |

