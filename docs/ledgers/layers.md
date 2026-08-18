# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T16:09:12.614Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.704 | -2.657 | 3.249 | 13.153 |
| boxes | 0.407 | -3.498 | 4.02 | 7.933 |
| inline-styles | 0.54 | -9.329 | 13.12 | 19.734 |
| replaced-boxes | 0.464 | -2.274 | 10.366 | 11.462 |
| wrapping | 0.325 | -0.609 | 3.295 | 10.136 |

