# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T11:07:27.966Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.594 | -1.13 | 2.537 | 13.128 |
| boxes | 0.485 | -3.687 | -3.948 | 8.275 |
| inline-styles | 0.79 | -4.777 | 14.832 | 20.028 |
| replaced-boxes | 0.612 | 0.572 | 6.391 | 10.998 |
| wrapping | 0.395 | -1.671 | 2.488 | 12.588 |

