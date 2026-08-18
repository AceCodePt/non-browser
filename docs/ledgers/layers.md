# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T07:31:46.807Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.5 | 0.155 | 5.276 | 11.344 |
| boxes | 0.435 | -3.674 | 3.397 | 9.104 |
| inline-styles | 0.785 | -2.229 | 14.336 | 22.631 |
| replaced-boxes | 0.73 | 0.41 | 5.093 | 10.573 |
| wrapping | 0.352 | -3.03 | 4.018 | 6.281 |

