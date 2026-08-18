# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T21:48:38.529Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.499 | -2.604 | 4.064 | 11.121 |
| boxes | 0.385 | -3.671 | 3.074 | 5.099 |
| inline-styles | 0.716 | -6.824 | 10.418 | 19.171 |
| replaced-boxes | 0.521 | 0.179 | 3.242 | 10.521 |
| wrapping | 0.366 | 0.308 | -0.931 | 10.212 |

