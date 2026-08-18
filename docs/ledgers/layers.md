# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T20:45:14.841Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.527 | -2.663 | 8.122 | 12.437 |
| boxes | 0.443 | -7.434 | 5.445 | 8.729 |
| inline-styles | 0.583 | -2.909 | 2.085 | 23.164 |
| replaced-boxes | 0.634 | -3.365 | 5.049 | 10.413 |
| wrapping | 0.454 | -3.002 | 4.532 | 10.178 |

