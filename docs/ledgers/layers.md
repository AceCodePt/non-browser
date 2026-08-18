# Layers Ledger — selective render entry functions

- Generated: 2026-08-18T12:15:25.947Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.704 | -6.646 | 6.39 | 14.068 |
| boxes | 0.429 | -3.761 | 4.239 | 8.795 |
| inline-styles | 0.567 | -2.969 | 8.477 | 15.654 |
| replaced-boxes | 0.527 | -0.899 | 7.372 | 10.203 |
| wrapping | 0.52 | -3.022 | 4.273 | 10.316 |

