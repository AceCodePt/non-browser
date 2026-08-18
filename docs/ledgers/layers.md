# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T21:19:07.359Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.491 | 1.207 | 1.215 | 10.61 |
| boxes | 0.422 | 0.231 | 2.655 | 6.869 |
| inline-styles | 0.579 | -3.83 | 13.165 | 19.109 |
| replaced-boxes | 0.547 | -6.394 | 7.415 | 8.94 |
| wrapping | 0.367 | -5.154 | -1.112 | 6.183 |

