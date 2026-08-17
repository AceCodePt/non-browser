# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T12:39:16.633Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.689 | -7.824 | 4.67 | 18.697 |
| boxes | 0.415 | -5.054 | 3.587 | 8.452 |
| inline-styles | 0.773 | -4.759 | 14.442 | 24.484 |
| replaced-boxes | 0.673 | -7.373 | 4.7 | 10.658 |
| wrapping | 0.351 | 0.902 | 4.923 | 10.565 |

