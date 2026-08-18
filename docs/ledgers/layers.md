# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T20:06:48.287Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.473 | 0.716 | 2.06 | 11.228 |
| boxes | 0.387 | 0.212 | 6.105 | 8.506 |
| inline-styles | 0.541 | -15.427 | 11.614 | 18.866 |
| replaced-boxes | 0.496 | -4.043 | 0.004 | 6.869 |
| wrapping | 0.386 | -3.765 | 4.732 | 10.201 |

