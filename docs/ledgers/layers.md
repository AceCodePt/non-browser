# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T13:01:42.091Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.386 | 0.149 | 3.682 | 5.211 |
| boxes | 0.335 | 0.047 | 3.892 | 4.333 |
| inline-styles | 0.437 | -0.442 | 3.394 | 4.397 |
| replaced-boxes | 0.38 | 0.148 | 1.696 | 5.233 |
| wrapping | 0.273 | 0.129 | 3.979 | 4.545 |

