# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T14:02:41.673Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.398 | -0.386 | 3.705 | 5.318 |
| boxes | 0.352 | 0.022 | 3.154 | 4.374 |
| inline-styles | 0.452 | 0.34 | 3.503 | 4.45 |
| replaced-boxes | 0.416 | 0.144 | 4.504 | 5.243 |
| wrapping | 0.309 | 0.195 | 4.011 | 4.612 |

