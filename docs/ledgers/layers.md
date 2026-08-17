# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T16:20:37.743Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.739 | -2.204 | 6.006 | 13.553 |
| boxes | 0.424 | -4.31 | 4.401 | 8.548 |
| inline-styles | 0.71 | -4.736 | 11.878 | 23.422 |
| replaced-boxes | 0.781 | -4.867 | 7.464 | 13.641 |
| wrapping | 0.355 | -8.275 | 5.058 | 10.782 |

