# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T16:13:09.841Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.488 | -0.167 | 3.642 | 12.513 |
| boxes | 0.413 | 0.237 | -0.908 | 5.744 |
| inline-styles | 0.569 | -3.001 | 13.881 | 19.037 |
| replaced-boxes | 0.539 | -7.442 | 6.411 | 11.997 |
| wrapping | 0.469 | -1.255 | 4.342 | 10.191 |

