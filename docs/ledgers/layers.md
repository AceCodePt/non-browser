# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T14:27:26.646Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.534 | -0.302 | 5.614 | 11.376 |
| boxes | 0.447 | 0.213 | 1.644 | 7.547 |
| inline-styles | 0.667 | -3.82 | 12.945 | 19.903 |
| replaced-boxes | 0.541 | -3.988 | 3.197 | 9.109 |
| wrapping | 0.331 | -1.402 | 4.932 | 10.214 |

