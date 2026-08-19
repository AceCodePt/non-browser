# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T01:46:19.054Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.569 | -6.184 | 3.21 | 11.862 |
| boxes | 0.428 | -3.183 | 4.007 | 9.097 |
| inline-styles | 0.533 | 1.039 | 16.025 | 23.435 |
| replaced-boxes | 0.574 | -4.245 | 3.064 | 10.093 |
| wrapping | 0.444 | 0.857 | -0.186 | 12.293 |

