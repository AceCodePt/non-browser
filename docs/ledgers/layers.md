# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T09:59:23.376Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.519 | -3.368 | 5.808 | 10.796 |
| boxes | 0.428 | -3.722 | 5.087 | 7.681 |
| inline-styles | 0.753 | -0.591 | 11.71 | 19.377 |
| replaced-boxes | 0.623 | -4.758 | 7.084 | 10.574 |
| wrapping | 0.348 | -2.441 | 3.292 | 10.151 |

