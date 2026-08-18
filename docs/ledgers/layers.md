# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T17:51:12.022Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.453 | -8.492 | -0.528 | 11.424 |
| boxes | 0.395 | 0.305 | 3.763 | 8.776 |
| inline-styles | 0.523 | -5.335 | 17.346 | 23.219 |
| replaced-boxes | 0.56 | -1.449 | 4.479 | 10.167 |
| wrapping | 0.426 | -2.901 | 2.727 | 10.23 |

