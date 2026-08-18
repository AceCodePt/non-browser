# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T17:55:26.080Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.498 | 2.549 | 4.24 | 13.2 |
| boxes | 0.426 | -3.695 | 2.188 | 7.239 |
| inline-styles | 0.595 | -6.757 | 17.271 | 20.582 |
| replaced-boxes | 0.535 | -8.631 | 3.475 | 10.309 |
| wrapping | 0.362 | -3.012 | 6.112 | 10.643 |

