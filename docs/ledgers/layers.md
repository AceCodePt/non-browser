# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T03:49:40.158Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.527 | 1.272 | 6.297 | 12.926 |
| boxes | 0.455 | -3.642 | 0.533 | 9.071 |
| inline-styles | 0.538 | -1.12 | 11.719 | 19.79 |
| replaced-boxes | 0.51 | -0.107 | 2.349 | 6.173 |
| wrapping | 0.331 | -3.484 | 4.469 | 6.087 |

