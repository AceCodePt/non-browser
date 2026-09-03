# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T12:29:19.797Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.369 | 0.203 | 4.542 | 5.185 |
| boxes | 0.317 | 0.068 | 3.846 | 4.341 |
| inline-styles | 0.407 | 0.333 | 0.918 | 4.314 |
| replaced-boxes | 0.371 | 0.094 | 3.904 | 5.147 |
| wrapping | 0.26 | 0.179 | 4.034 | 4.507 |

