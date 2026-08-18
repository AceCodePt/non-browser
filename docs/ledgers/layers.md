# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T19:37:20.141Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.498 | 1.378 | 5.465 | 11.479 |
| boxes | 0.417 | -4.729 | 3.558 | 8.4 |
| inline-styles | 0.677 | 1.031 | 15.831 | 21.292 |
| replaced-boxes | 0.567 | -0.945 | 4.232 | 10.121 |
| wrapping | 0.358 | -3.074 | 1.155 | 6.71 |

