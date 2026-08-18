# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T02:41:23.063Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.556 | 1.175 | 9.557 | 13.385 |
| boxes | 0.37 | -7.784 | 2.392 | 5.784 |
| inline-styles | 0.696 | -5.049 | 15.411 | 21.276 |
| replaced-boxes | 0.688 | -0.046 | 8.684 | 14.361 |
| wrapping | 0.338 | -1.034 | 1.858 | 10.428 |

