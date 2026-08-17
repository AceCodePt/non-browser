# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T06:53:03.413Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.696 | -10.492 | 7.197 | 18.777 |
| boxes | 0.409 | -8.952 | 1.181 | 9.216 |
| inline-styles | 0.659 | -1.612 | 12.683 | 30.534 |
| replaced-boxes | 0.74 | -8.424 | 5.925 | 23.521 |
| wrapping | 0.368 | -1.972 | 0.717 | 15.1 |

