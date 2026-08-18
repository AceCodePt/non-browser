# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T04:05:23.288Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.715 | -1.536 | 4.92 | 12.343 |
| boxes | 0.408 | -5.546 | -3.321 | 5.486 |
| inline-styles | 0.646 | -2.593 | 9.715 | 22.331 |
| replaced-boxes | 0.623 | -2.426 | 10.887 | 14.042 |
| wrapping | 0.361 | -2.823 | 3.587 | 10.225 |

