# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T13:54:55.278Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.373 | 0.172 | 4.166 | 5.303 |
| boxes | 0.335 | 0.092 | 3.905 | 4.345 |
| inline-styles | 0.43 | -0.51 | 3.389 | 4.427 |
| replaced-boxes | 0.406 | 0.042 | 3.535 | 5.235 |
| wrapping | 0.293 | 0.189 | 3.52 | 4.584 |

