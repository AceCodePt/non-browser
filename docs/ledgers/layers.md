# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T08:18:09.758Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.407 | 0.262 | 3.818 | 5.253 |
| boxes | 0.376 | -0.599 | 3.907 | 4.398 |
| inline-styles | 0.516 | 0.259 | 2.914 | 4.552 |
| replaced-boxes | 0.466 | 0.137 | 3.884 | 5.258 |
| wrapping | 0.327 | 0.081 | 3.955 | 4.555 |

