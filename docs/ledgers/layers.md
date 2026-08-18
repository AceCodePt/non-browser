# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T03:31:14.245Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.53 | -2.608 | 5.11 | 11.049 |
| boxes | 0.408 | -4.298 | 2.473 | 8.426 |
| inline-styles | 0.583 | -3.96 | 17.413 | 21.065 |
| replaced-boxes | 0.792 | -7.325 | 7.436 | 11.034 |
| wrapping | 0.414 | -1.486 | 5.485 | 9.149 |

