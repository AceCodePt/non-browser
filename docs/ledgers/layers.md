# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T21:15:38.083Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.509 | -1.3 | 5.764 | 15.423 |
| boxes | 0.423 | -3.719 | 4.44 | 9.034 |
| inline-styles | 0.793 | -6.243 | 8.992 | 19.9 |
| replaced-boxes | 0.59 | -4.096 | 5.78 | 10.268 |
| wrapping | 0.363 | -3.005 | 0.706 | 9.333 |

