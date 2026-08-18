# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T19:03:24.867Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.484 | 0.109 | 1.884 | 11.493 |
| boxes | 0.411 | 0.312 | -0.879 | 7.937 |
| inline-styles | 0.576 | -0.766 | 10.812 | 20.913 |
| replaced-boxes | 0.57 | -3.944 | 3.413 | 11.409 |
| wrapping | 0.392 | -16.577 | 5.145 | 10.675 |

