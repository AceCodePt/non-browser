# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T08:07:06.479Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.345 | 0.254 | 4.103 | 5.204 |
| boxes | 0.303 | 0.109 | 3.855 | 4.304 |
| inline-styles | 0.413 | 0.391 | 3.535 | 4.414 |
| replaced-boxes | 0.359 | 0.055 | 3.843 | 5.122 |
| wrapping | 0.254 | 0.185 | 3.927 | 4.523 |

