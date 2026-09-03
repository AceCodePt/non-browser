# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T09:34:51.040Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.349 | 0.294 | 3.967 | 5.256 |
| boxes | 0.32 | 0.035 | 3.92 | 4.366 |
| inline-styles | 0.422 | 0.388 | 3.451 | 4.453 |
| replaced-boxes | 0.387 | 0.036 | 3.729 | 5.221 |
| wrapping | 0.264 | 0.156 | 4.002 | 4.525 |

