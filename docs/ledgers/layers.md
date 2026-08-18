# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T23:00:58.638Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.569 | -7.759 | -0.586 | 13.157 |
| boxes | 0.402 | -0.466 | 4.138 | 5.044 |
| inline-styles | 0.577 | -6.814 | 12.707 | 18.564 |
| replaced-boxes | 0.543 | -0.462 | -2.161 | 10.325 |
| wrapping | 0.347 | 0.914 | 0.807 | 6.288 |

