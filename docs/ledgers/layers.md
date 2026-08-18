# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T08:47:11.005Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.653 | -0.141 | 2.036 | 11.394 |
| boxes | 0.421 | -1.511 | -0.126 | 5.068 |
| inline-styles | 0.566 | 1.115 | 15.103 | 21.098 |
| replaced-boxes | 0.61 | -4.076 | 2.145 | 10.25 |
| wrapping | 0.324 | -6.728 | 3.823 | 10.142 |

