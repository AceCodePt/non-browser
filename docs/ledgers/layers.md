# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T17:35:26.203Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.61 | -3.619 | 5.616 | 11.619 |
| boxes | 0.384 | -6.069 | 6.597 | 7.37 |
| inline-styles | 0.53 | -0.516 | 12.363 | 20.396 |
| replaced-boxes | 0.554 | -2.475 | 5.96 | 10.412 |
| wrapping | 0.322 | 0.922 | 3.324 | 10.38 |

