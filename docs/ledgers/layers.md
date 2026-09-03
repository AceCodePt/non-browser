# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T14:20:13.981Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.407 | 0.156 | 3.851 | 5.301 |
| boxes | 0.33 | 0.062 | 3.897 | 4.334 |
| inline-styles | 0.463 | 0.339 | 3.595 | 4.439 |
| replaced-boxes | 0.4 | 0.103 | 4.541 | 5.199 |
| wrapping | 0.278 | 0.024 | 2.104 | 4.57 |

