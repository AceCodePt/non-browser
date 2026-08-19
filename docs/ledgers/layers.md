# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T05:49:07.981Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.632 | -2.711 | 2.386 | 11.581 |
| boxes | 0.446 | 0.153 | 0.186 | 5.127 |
| inline-styles | 0.722 | -3.318 | 12.275 | 15.813 |
| replaced-boxes | 0.636 | -0.853 | 7.923 | 10.373 |
| wrapping | 0.365 | -6.665 | 3.021 | 11.005 |

