# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T23:32:04.865Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.509 | 2.695 | 2.442 | 11.6 |
| boxes | 0.584 | -6.546 | 1.021 | 6.784 |
| inline-styles | 0.643 | -2.904 | 7.909 | 11.078 |
| replaced-boxes | 0.645 | -12.937 | 9.18 | 12.987 |
| wrapping | 0.364 | -2.828 | 4.865 | 10.487 |

