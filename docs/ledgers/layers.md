# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T06:57:33.286Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.562 | -3.353 | 6.701 | 12.767 |
| boxes | 0.444 | -4.454 | 3.945 | 9.004 |
| inline-styles | 0.612 | -5.67 | 13.06 | 21.854 |
| replaced-boxes | 0.586 | -2.133 | 4.914 | 12.746 |
| wrapping | 0.353 | -0.674 | 4.58 | 10.173 |

