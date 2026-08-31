---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern, color-values-modern]
---

# Task: background-image gradients, sizing, positioning, repeat, and layering

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The engine paints only background-color (css.ts:1840 reads background-color or the background shorthand as a color). Real documents use background-image with gradients (linear-gradient, radial-gradient) and background-size/position/repeat/clip/origin. This slice lands the background painting surface: gradient generation, the full background shorthand, sizing/positioning/repeat of background layers, and multiple stacked backgrounds. Image decoding (url() raster content) stays chartered-out — url() backgrounds are documented as unsupported, not silently dropped.

## Requirements

- [ ] linear-gradient() and radial-gradient() render per css-images-3 §3.4 with angles, side/corner keywords, color stops (lengths, percentages, hard stops), and gradients participating as background layers in the background shorthand.
- [ ] background-image parses a comma-separated list; multiple layers stack in source order (first on top) exactly as Chrome paints them.
- [ ] background-size (lengths, percentages, cover, contain, auto, and the two-value form), background-position (keywords, lengths, percentages, and offset-from-edge syntax), and background-repeat (repeat/no-repeat/round/space and two-value forms) all affect the painted result per Chrome.
- [ ] background-clip (border-box/padding-box/content-box) and background-origin change the painted region per Chrome, including with border-radius.
- [ ] The background shorthand parses the full grammar (image/position/size/repeat/clip/origin/color in any order) with computed-style serialization matching Chrome.
- [ ] Corpus under corpus/backgrounds/ exercises a gradient, a gradient+color layer, a two-layer stack, cover/contain, and clip/origin cases; verify script scripts/verify-backgrounds.mjs compares computed styles and non-text paint against Chrome; a charter §11 row with a corpus token is added.
- [ ] docs/ledgers note records url() raster backgrounds as unsupported (chartered-out image decode).

## Verification

npm run build passes. node scripts/verify-backgrounds.mjs exits 0 — computed-style strings match Chrome and non-text screenshot pixels are within the ΔE≤2/≤1% band for every fixture. Existing background-color corpora stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement image decoding or url() raster backgrounds — they are chartered-out; url() in background-image is documented as unsupported, never silently dropped.
- Do not skip the background shorthand's full grammar — background must parse size/position/repeat/clip/origin/image/color together, not just the color portion.
- Do not paint gradient color stops with naive lerp that diverges from Chrome — stop-color interpolation and hard stops must match within the pixel band.
- Do not regress the existing background-color behavior (corpus/spine, border-radius must stay green).
- Do not implement vendor-prefixed gradients (-webkit-linear-gradient etc.).
- Do not add unsupported modern color-interpolation-method syntax (in oklab etc.) without a fixture proving Chrome parity.
