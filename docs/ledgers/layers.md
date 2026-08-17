# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T17:16:23.750Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.515 | -1.657 | 0.835 | 11.406 |
| boxes | 0.441 | -3.655 | 0.764 | 7.729 |
| inline-styles | 0.724 | -0.682 | 12.578 | 21.62 |
| replaced-boxes | 0.665 | -7.392 | 4.303 | 12.909 |
| wrapping | 0.422 | 0.923 | 6.175 | 12.182 |

