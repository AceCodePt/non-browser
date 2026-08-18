# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T04:39:32.637Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.701 | -0.815 | 9.023 | 15.343 |
| boxes | 0.459 | -3.713 | 2.418 | 5.448 |
| inline-styles | 0.613 | -6.923 | 14.227 | 24.552 |
| replaced-boxes | 0.593 | -8.239 | 4.964 | 10.395 |
| wrapping | 0.385 | 0.895 | 4.614 | 10.522 |

