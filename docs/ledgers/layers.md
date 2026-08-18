# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T13:23:22.258Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.533 | -0.631 | 5.346 | 11.254 |
| boxes | 0.406 | -0.915 | 4.196 | 8.964 |
| inline-styles | 0.586 | -14.314 | 12.333 | 19.281 |
| replaced-boxes | 0.555 | -0.692 | 0.329 | 6.631 |
| wrapping | 0.364 | -2.148 | 4.092 | 10.162 |

