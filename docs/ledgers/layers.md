# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T01:14:37.257Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.509 | -14.656 | 2.304 | 14.822 |
| boxes | 0.427 | -11.046 | 5.99 | 9.446 |
| inline-styles | 0.609 | -1.063 | 10.635 | 21.224 |
| replaced-boxes | 0.556 | -3.981 | 5.131 | 10.501 |
| wrapping | 0.349 | -2.723 | 1.114 | 6.746 |

