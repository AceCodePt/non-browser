# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T01:33:05.487Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.476 | -3.721 | 8.557 | 11.867 |
| boxes | 0.411 | -6.296 | 2.918 | 7.675 |
| inline-styles | 0.619 | 1.089 | 13.004 | 19.783 |
| replaced-boxes | 0.616 | -4.741 | 8.176 | 10.294 |
| wrapping | 0.355 | 0.967 | 5.887 | 10.231 |

