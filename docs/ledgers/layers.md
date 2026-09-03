# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T14:41:27.556Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.407 | 0.025 | 3.773 | 5.38 |
| boxes | 0.34 | -2.573 | 3.818 | 4.407 |
| inline-styles | 0.458 | 0.28 | 1.165 | 4.668 |
| replaced-boxes | 0.402 | -2.036 | 4.617 | 5.475 |
| wrapping | 0.296 | -0.278 | 4.155 | 5.008 |

