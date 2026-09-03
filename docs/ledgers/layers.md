# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T13:59:58.407Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.374 | 0.073 | 3.984 | 5.242 |
| boxes | 0.318 | 0.037 | 3.539 | 4.281 |
| inline-styles | 0.418 | -0.412 | 3.419 | 4.36 |
| replaced-boxes | 0.357 | -0.758 | 4.553 | 5.23 |
| wrapping | 0.255 | 0.151 | 3.173 | 4.506 |

