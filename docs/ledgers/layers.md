# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T14:19:52.844Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.673 | 0.784 | 8.693 | 19.862 |
| boxes | 0.424 | -7.732 | 3.812 | 8.751 |
| inline-styles | 0.596 | -3.226 | 21.443 | 31.478 |
| replaced-boxes | 0.536 | -6.117 | 9.143 | 14.505 |
| wrapping | 0.335 | -3.458 | 0.08 | 11.986 |

