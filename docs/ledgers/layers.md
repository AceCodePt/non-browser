# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T02:59:02.703Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.5 | -2.771 | 5.129 | 11.472 |
| boxes | 0.411 | -3.805 | 0.969 | 7.469 |
| inline-styles | 0.669 | -10.938 | 20.502 | 24.829 |
| replaced-boxes | 0.487 | -6.87 | -2.691 | 6.504 |
| wrapping | 0.344 | -0.22 | 0.565 | 12.32 |

