# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T17:17:08.765Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.468 | -2.653 | 7.181 | 9.877 |
| boxes | 0.382 | -1.669 | 6.551 | 9.015 |
| inline-styles | 0.538 | -2.857 | 7.178 | 18.669 |
| replaced-boxes | 0.467 | -8.362 | 0.609 | 9.011 |
| wrapping | 0.329 | -6.105 | 6.596 | 10.378 |

