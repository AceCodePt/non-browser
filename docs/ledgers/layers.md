# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T10:44:15.326Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.367 | 0.217 | 4.554 | 5.268 |
| boxes | 0.329 | 0.094 | 3.811 | 4.324 |
| inline-styles | 0.429 | 0.232 | 3.548 | 4.491 |
| replaced-boxes | 0.398 | 0.151 | 4.496 | 5.179 |
| wrapping | 0.286 | 0.141 | 3.213 | 4.541 |

