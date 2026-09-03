# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T10:19:13.345Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.355 | 0.217 | 3.821 | 5.223 |
| boxes | 0.317 | 0.005 | 3.926 | 4.426 |
| inline-styles | 0.43 | 0.378 | 3.383 | 4.427 |
| replaced-boxes | 0.384 | -0.691 | 4.551 | 5.205 |
| wrapping | 0.293 | 0.195 | 3.969 | 4.53 |

