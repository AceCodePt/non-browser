# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T17:51:02.826Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.525 | -6.798 | 5.64 | 11.654 |
| boxes | 0.433 | -3.708 | 3.934 | 8.337 |
| inline-styles | 0.794 | -3.783 | 19.823 | 23.994 |
| replaced-boxes | 0.555 | -4.751 | 5.166 | 10.125 |
| wrapping | 0.358 | -5.006 | 3.701 | 10.959 |

