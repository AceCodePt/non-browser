# Layers Ledger — selective render entry functions

- Generated: 2026-09-04T06:30:40.256Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.393 | 0.241 | 4.51 | 5.22 |
| boxes | 0.36 | 0.065 | 3.851 | 4.424 |
| inline-styles | 0.509 | 0.262 | 3.539 | 4.544 |
| replaced-boxes | 0.445 | 0.108 | 3.925 | 5.258 |
| wrapping | 0.303 | 0.21 | 3.988 | 4.589 |

