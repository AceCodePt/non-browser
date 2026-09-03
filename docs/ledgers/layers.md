# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T11:05:54.605Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.386 | 0.12 | 4.557 | 5.246 |
| boxes | 0.328 | -0.775 | 3.847 | 4.381 |
| inline-styles | 0.428 | 0.272 | 2.73 | 4.478 |
| replaced-boxes | 0.402 | 0.102 | 4.645 | 5.297 |
| wrapping | 0.276 | 0.152 | 3.331 | 4.591 |

