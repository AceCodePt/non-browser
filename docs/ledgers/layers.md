# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T08:39:56.674Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.501 | 1.099 | 2.697 | 11.344 |
| boxes | 0.428 | -4.592 | 4.845 | 8.722 |
| inline-styles | 0.59 | -5.901 | 5.895 | 21.371 |
| replaced-boxes | 0.646 | -9.045 | 6.675 | 12.424 |
| wrapping | 0.383 | -4.269 | 5.1 | 10.279 |

