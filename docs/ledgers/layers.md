# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T05:46:51.890Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.718 | 90.007 | -150.444 | 94.196 |
| boxes | 0.682 | 9.439 | -4.03 | 29.781 |
| inline-styles | 0.837 | 22.992 | 8.917 | 52.381 |
| replaced-boxes | 0.685 | 13.563 | 3.429 | 24.68 |
| wrapping | 0.38 | 120.425 | -42.292 | 129.228 |

