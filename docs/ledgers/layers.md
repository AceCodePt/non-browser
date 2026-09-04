# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T12:59:55.886Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.389 | -0.224 | 4.429 | 5.199 |
| boxes | 0.355 | -0.545 | 3.801 | 4.37 |
| inline-styles | 0.498 | 0.264 | 3.119 | 4.496 |
| replaced-boxes | 0.443 | 0.083 | 4.026 | 5.227 |
| wrapping | 0.296 | 0.164 | 3.898 | 4.548 |

