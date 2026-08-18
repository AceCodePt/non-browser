# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T20:40:44.666Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.486 | -7.61 | 5.827 | 13.168 |
| boxes | 0.413 | -3.663 | -3.582 | 4.941 |
| inline-styles | 0.597 | -5.513 | 15.865 | 19.188 |
| replaced-boxes | 0.598 | -4.497 | 8.508 | 11.545 |
| wrapping | 0.371 | -3.082 | 3.757 | 6.086 |

