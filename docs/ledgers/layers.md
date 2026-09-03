# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T17:08:50.944Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.455 | -0.596 | 4.684 | 5.526 |
| boxes | 0.371 | -0.637 | 4.147 | 4.717 |
| inline-styles | 0.484 | 0.218 | 2.711 | 4.688 |
| replaced-boxes | 0.428 | -0.014 | 3.657 | 5.433 |
| wrapping | 0.29 | -0.695 | 4.16 | 4.793 |

