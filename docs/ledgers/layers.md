# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T08:32:23.621Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.639 | -4.747 | 8.609 | 14.804 |
| boxes | 0.44 | 0.186 | 4.56 | 9.014 |
| inline-styles | 0.589 | 1.183 | 13.513 | 20.365 |
| replaced-boxes | 0.618 | -4.232 | 5.309 | 10.45 |
| wrapping | 0.328 | -4.642 | 3.372 | 10.451 |

