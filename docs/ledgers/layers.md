# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T20:41:30.911Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.623 | -4.869 | 8.305 | 13.093 |
| boxes | 0.415 | -4.529 | 3.92 | 5.079 |
| inline-styles | 0.586 | 1.028 | 14.363 | 20.774 |
| replaced-boxes | 0.614 | -1.145 | 4.194 | 9.682 |
| wrapping | 0.493 | -0.781 | 0.937 | 10.59 |

