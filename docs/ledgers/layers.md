# Layers Ledger — selective render entry functions

- Generated: 2026-08-19T00:38:21.104Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.52 | -3.511 | 3.59 | 14.781 |
| boxes | 0.371 | 0.207 | -2.518 | 6.329 |
| inline-styles | 0.648 | -1.155 | 12.206 | 20.35 |
| replaced-boxes | 0.637 | -1.471 | 6.928 | 10.374 |
| wrapping | 0.329 | -3.8 | 3.799 | 10.012 |

