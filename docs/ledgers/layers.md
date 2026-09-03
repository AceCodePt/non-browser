# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T14:34:12.567Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.404 | 0.283 | 2.394 | 5.324 |
| boxes | 0.364 | 0.091 | 3.888 | 4.416 |
| inline-styles | 0.465 | 0.348 | 2.681 | 4.55 |
| replaced-boxes | 0.421 | 0.153 | 4.237 | 5.407 |
| wrapping | 0.297 | 0.122 | 4.016 | 4.571 |

