# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T18:25:07.095Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.592 | -1.244 | 6.206 | 20.24 |
| boxes | 0.424 | -6.319 | 3.622 | 5.126 |
| inline-styles | 0.615 | -7.661 | 10.7 | 19.401 |
| replaced-boxes | 0.461 | -24.225 | 4.071 | 6.111 |
| wrapping | 0.345 | 0.885 | 4.633 | 10.229 |

