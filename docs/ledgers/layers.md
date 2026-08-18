# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T08:51:16.386Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.657 | -2.945 | 0.731 | 12.104 |
| boxes | 0.424 | -3.84 | 3.12 | 6.018 |
| inline-styles | 0.627 | -6.606 | 11.602 | 20.93 |
| replaced-boxes | 0.695 | -3.377 | 4.583 | 10.408 |
| wrapping | 0.562 | -1.943 | 9.095 | 14.322 |

