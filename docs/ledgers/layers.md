# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T12:53:51.061Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.712 | -18.721 | 4.833 | 16.682 |
| boxes | 0.418 | -7.573 | 2.306 | 12.76 |
| inline-styles | 0.802 | -10.741 | 33.929 | 42.997 |
| replaced-boxes | 0.747 | -12.69 | 16.275 | 26.485 |
| wrapping | 0.417 | -11.387 | 6.259 | 21.562 |

