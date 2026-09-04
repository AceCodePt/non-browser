# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T08:34:00.766Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.383 | 0.155 | 4.542 | 5.219 |
| boxes | 0.347 | 0.065 | 3.375 | 4.411 |
| inline-styles | 0.492 | 0.276 | 2.88 | 4.49 |
| replaced-boxes | 0.432 | 0.163 | 4.624 | 5.259 |
| wrapping | 0.301 | 0.192 | 3.985 | 4.552 |

