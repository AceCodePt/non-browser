# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T00:58:56.674Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.554 | -4.164 | 3.584 | 11.877 |
| boxes | 0.4 | -7.579 | -1.841 | 5.123 |
| inline-styles | 0.656 | -13.299 | 16.786 | 22.14 |
| replaced-boxes | 0.66 | -4.571 | 7.527 | 10.894 |
| wrapping | 0.317 | -2.95 | 0.689 | 10.213 |

