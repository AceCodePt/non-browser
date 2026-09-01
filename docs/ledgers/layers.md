# Layers Ledger — selective render entry functions

- Generated: 2026-09-01T05:14:17.434Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.434 | 0.183 | 4.582 | 5.336 |
| boxes | 0.376 | 0.059 | 3.981 | 4.488 |
| inline-styles | 0.491 | 0.321 | 3.569 | 4.496 |
| replaced-boxes | 0.449 | 0.078 | 4.732 | 5.352 |
| wrapping | 0.346 | 0.187 | 4.049 | 4.657 |

