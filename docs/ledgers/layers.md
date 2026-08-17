# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T16:16:35.917Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.611 | -3.338 | 8.021 | 12.703 |
| boxes | 0.49 | -7.44 | 5.417 | 9.039 |
| inline-styles | 0.569 | -6.955 | 16.513 | 22.903 |
| replaced-boxes | 0.754 | -11.254 | 7.276 | 12.954 |
| wrapping | 0.385 | -5.32 | 0.403 | 10.366 |

