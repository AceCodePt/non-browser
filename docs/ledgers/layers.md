# Layers Ledger — selective render entry functions

- Generated: 2026-08-17T21:34:05.608Z
- Gate: `node scripts/verify-layers.mjs` (session-idle `*layers*` case)
- Coverage: every corpus fixture with `harvest.html` + a viewport; each selective layer must equal the same layer from a full `renderHtml` call byte-identical.
- Method: `computedStylesOf` = prepare (parse+cascade+resolveStyles), `rectsOf` = prepare+layout, `renderHtml` = prepare+layout+paint. The three entry calls run back-to-back per pass; layout = rectsOf − styles-only and paint = renderHtml − rectsOf are attributed within the same pass so noise shifts all three equally, and the minimum of 9 passes wins for each quantity. Milliseconds.

## Cost split per spine fixture

| fixture | cascade ms | layout ms | paint ms | full ms |
|---|---|---|---|---|
| basic-text | 0.532 | 0.108 | 5.476 | 11.609 |
| boxes | 0.38 | -1.254 | 1.784 | 8.674 |
| inline-styles | 0.585 | -1.985 | 11.974 | 20.194 |
| replaced-boxes | 0.574 | -3.296 | -1.254 | 10.478 |
| wrapping | 0.341 | -3.017 | 6.842 | 10.107 |

