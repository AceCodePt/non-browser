# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T02:57:06.373Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.518 | 0.769 | 4.509 | 11.363 |
| boxes | 0.423 | -9.485 | 6.114 | 9.1 |
| inline-styles | 0.591 | -11.194 | 8.301 | 15.151 |
| replaced-boxes | 0.67 | -7.038 | 1.82 | 11.149 |
| wrapping | 0.356 | -2.218 | 5.526 | 10.347 |

