# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T04:57:52.275Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.481 | 1.329 | 4.91 | 11.689 |
| boxes | 0.388 | -3.656 | 4.286 | 7.909 |
| inline-styles | 0.697 | -3.309 | 14.934 | 21.095 |
| replaced-boxes | 0.63 | -4.824 | 6.698 | 9.582 |
| wrapping | 0.399 | -1.605 | 4.812 | 10.3 |

