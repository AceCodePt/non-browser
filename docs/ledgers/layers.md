# Layers Ledger — selective render entry functions

- Generated: 2026-09-03T05:47:00.314Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.392 | -0.441 | 4.491 | 5.286 |
| boxes | 0.332 | 0.093 | 3.824 | 4.398 |
| inline-styles | 0.444 | 0.329 | 3.462 | 4.425 |
| replaced-boxes | 0.375 | -0.715 | 4.634 | 5.275 |
| wrapping | 0.254 | 0.189 | 4.047 | 4.567 |

