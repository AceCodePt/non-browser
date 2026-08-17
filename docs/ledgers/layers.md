# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T16:27:02.089Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.718 | -2.383 | 2.969 | 11.536 |
| boxes | 0.397 | -3.813 | 8.193 | 9.073 |
| inline-styles | 0.576 | -0.491 | 20.988 | 22.96 |
| replaced-boxes | 0.749 | -5.241 | 2.222 | 9.834 |
| wrapping | 0.355 | -3.412 | 6.652 | 9.641 |

