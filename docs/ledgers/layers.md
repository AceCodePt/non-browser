# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T05:44:12.247Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.441 | 1.308 | 5.283 | 11.289 |
| boxes | 0.424 | -15.667 | 1.742 | 9.035 |
| inline-styles | 0.709 | -3.578 | 13.842 | 21.686 |
| replaced-boxes | 0.534 | -5.393 | 10.961 | 12.463 |
| wrapping | 0.337 | 0.935 | 2.694 | 11.8 |

