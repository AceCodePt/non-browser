# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T13:57:14.757Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.484 | -0.442 | 6.043 | 11.352 |
| boxes | 0.433 | -3.714 | 5.564 | 6.342 |
| inline-styles | 0.653 | -3.108 | 13.282 | 19.227 |
| replaced-boxes | 0.522 | -4.707 | 5.917 | 10.241 |
| wrapping | 0.363 | 0.937 | 0.492 | 9.377 |

