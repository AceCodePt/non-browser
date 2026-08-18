# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T15:39:14.169Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.591 | -1.246 | 3.66 | 11.343 |
| boxes | 0.415 | 0.231 | 4.279 | 5.161 |
| inline-styles | 0.766 | 1.062 | 13.146 | 19.667 |
| replaced-boxes | 0.557 | -5.231 | 3.998 | 10.237 |
| wrapping | 0.365 | 0.914 | 4.589 | 10.092 |

