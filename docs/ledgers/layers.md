# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T13:36:38.033Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.402 | 0.183 | 4.572 | 5.296 |
| boxes | 0.331 | 0.065 | 3.911 | 4.357 |
| inline-styles | 0.43 | 0.351 | 2.908 | 4.437 |
| replaced-boxes | 0.38 | 0.117 | 4.613 | 5.214 |
| wrapping | 0.263 | 0.17 | 4.017 | 4.513 |

