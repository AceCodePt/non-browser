# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T06:23:24.647Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.582 | -2.308 | 1.137 | 10.972 |
| boxes | 0.417 | 0.208 | 3.164 | 7.021 |
| inline-styles | 0.594 | -1.222 | 16.39 | 22.526 |
| replaced-boxes | 0.635 | -2.999 | 1.283 | 10.383 |
| wrapping | 0.356 | 0.915 | -1.554 | 10.1 |

