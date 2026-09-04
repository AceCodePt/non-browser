# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T08:23:36.519Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.385 | 0.209 | 3.94 | 5.241 |
| boxes | 0.341 | 0.057 | 3.849 | 4.353 |
| inline-styles | 0.478 | 0.239 | 2.792 | 4.469 |
| replaced-boxes | 0.436 | 0.153 | 3.804 | 5.247 |
| wrapping | 0.298 | 0.107 | 4.049 | 4.567 |

