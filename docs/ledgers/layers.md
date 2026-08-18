# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T20:11:17.606Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.476 | -2.758 | 5.392 | 11.262 |
| boxes | 0.395 | -3.77 | 6.828 | 8.915 |
| inline-styles | 0.562 | -2.902 | 10.359 | 19.344 |
| replaced-boxes | 0.479 | -4.041 | 0.918 | 8.675 |
| wrapping | 0.338 | -3.062 | 3.892 | 10.138 |

