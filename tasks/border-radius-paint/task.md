---
wait_human_start: false
wait_human_merge: false
dependencies: [text-mask-parity]
---

# Task: Border-Radius-Paint

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. border-radius (rounded corners) is ubiquitous in modern web design (buttons, cards, avatars) and the engine only paints rectangles: no border-radius in ComputedStyle, no rounded clipping, no elliptical corners. Even a single rounded button diverges at every corner pixel of the screenshot layer, plus border-radius affects the box's background/border paint region and can clip overflow. This is a paint-layer feature (layer 4) but also touches overflow clipping semantics (rounded clip on overflowing children).

## Requirements

- [ ] border-radius parsed into ComputedStyle (all four corners, shorthand and longhands, px and % radii, elliptical rx/ry, border-radius: 50% on squares/rectangles)
- [ ] Background and border paint to the rounded clip path, matching Chrome's raster within the charter §4 screenshot band (delta-E <=2, <=1% exceeding)
- [ ] overflow:hidden on a rounded element clips children to the rounded shape (a child that would poke out of a corner is clipped), verified against Chrome
- [ ] Corpus corpus/border-radius/ with four-layer fixtures (rounded button, 50% circle, elliptical corners, rounded+overflow clip, per-corner radii) and npm run verify:border-radius exiting 0 against Chrome
- [ ] Rect layer still exact (border-radius does not change the border-box rects; the box geometry is unchanged)

## Verification

npm run build passes. npm run verify:border-radius exits 0: rounded fixtures' screenshot pixels match Chrome within the charter band (with text still handled per the current mask/tier policy), a 50% circle on a square matches Chrome's ellipse, and overflow:hidden children clip to the rounded corner. Existing verify scripts remain green.

## Prohibited Patterns

- Do not approximate rounded corners with a rectangle plus corner pixels - corners must be true arcs matching Chrome's raster
- Do not ignore the elliptical (non-circular) case when rx != ry
- Do not apply border-radius without also applying it as the clip shape for overflow:hidden children
