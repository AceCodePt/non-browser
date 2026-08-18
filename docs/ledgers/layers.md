# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T10:29:14.839Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.458 | -1.763 | 3.632 | 7.145 |
| boxes | 0.384 | -3.769 | 1.834 | 6.927 |
| inline-styles | 0.675 | 1.062 | 3.398 | 22.499 |
| replaced-boxes | 0.554 | 0.43 | 0.513 | 11.722 |
| wrapping | 0.34 | -5.887 | 3.637 | 10.109 |

