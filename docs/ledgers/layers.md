# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T21:49:46.866Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.619 | -0.792 | 4.81 | 13.829 |
| boxes | 0.464 | -3.761 | 5.933 | 9.039 |
| inline-styles | 0.717 | -2.721 | 11.79 | 19.036 |
| replaced-boxes | 0.669 | -2.778 | 7.791 | 12.901 |
| wrapping | 0.436 | -6.632 | -0.812 | 9.594 |

