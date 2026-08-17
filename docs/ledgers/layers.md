# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T14:11:47.257Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.732 | -8.408 | 4.509 | 19.854 |
| boxes | 0.436 | -3.207 | 3.965 | 8.16 |
| inline-styles | 0.708 | -4.752 | 20.063 | 31.2 |
| replaced-boxes | 0.539 | -7.732 | 14.933 | 16.776 |
| wrapping | 0.423 | -5.688 | 0.602 | 10.257 |

