# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T17:21:21.339Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.598 | -1.903 | 3.951 | 13.91 |
| boxes | 0.407 | -3.774 | 0.221 | 5.049 |
| inline-styles | 0.625 | -4.137 | 13.35 | 22.387 |
| replaced-boxes | 0.659 | -13.731 | 1.141 | 10.438 |
| wrapping | 0.357 | 0.943 | 7.229 | 13.983 |

