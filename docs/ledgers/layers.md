# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T00:24:45.976Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.497 | -3.949 | -0.518 | 10.732 |
| boxes | 0.462 | -3.72 | 5.64 | 7.74 |
| inline-styles | 0.54 | -6.757 | 8.216 | 14.303 |
| replaced-boxes | 0.531 | -5.569 | 2.559 | 6.285 |
| wrapping | 0.355 | -11.835 | 1.52 | 9.817 |

