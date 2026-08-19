# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T06:57:27.427Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.608 | -2.674 | 3.417 | 11.445 |
| boxes | 0.434 | -3.723 | 6.325 | 8.77 |
| inline-styles | 0.661 | -6.37 | 8.324 | 19.901 |
| replaced-boxes | 0.607 | -5.28 | 10.307 | 12.251 |
| wrapping | 0.419 | 0.929 | -2.811 | 6.385 |

