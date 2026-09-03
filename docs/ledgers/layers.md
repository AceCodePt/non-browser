# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T11:50:06.903Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.391 | 0.212 | 4.557 | 5.27 |
| boxes | 0.337 | 0.022 | 3.938 | 4.391 |
| inline-styles | 0.445 | 0.281 | 3.505 | 4.521 |
| replaced-boxes | 0.39 | 0.135 | 3.304 | 5.218 |
| wrapping | 0.264 | 0.19 | 4.032 | 4.537 |

