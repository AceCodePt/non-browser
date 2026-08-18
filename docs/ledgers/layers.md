# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T22:27:00.944Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.481 | 1.167 | 4.09 | 11.4 |
| boxes | 0.412 | 0.305 | 4.306 | 8.937 |
| inline-styles | 0.638 | -3.803 | 9.284 | 19.293 |
| replaced-boxes | 0.561 | -6.042 | 3.942 | 10.1 |
| wrapping | 0.361 | 0.851 | 3.619 | 8.951 |

