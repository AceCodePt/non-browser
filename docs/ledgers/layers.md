# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T08:25:14.616Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.688 | -2.356 | 4.713 | 13.786 |
| boxes | 0.378 | -4.445 | 5.465 | 9.06 |
| inline-styles | 0.567 | -2.707 | 14.304 | 23.565 |
| replaced-boxes | 0.553 | -2.958 | 3.482 | 9.935 |
| wrapping | 0.341 | -2.309 | 3.867 | 10.021 |

