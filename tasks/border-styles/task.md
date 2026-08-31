---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern, color-values-modern]
---

# Task: dashed, dotted, double, groove, ridge, and hidden border styles

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The engine paints borders as solid/inset/outset rectangles only (borderStyle in css.ts:324 limits to none|solid|inset|outset; paint.ts paintBorder fills flat rects). Modern documents use dashed, dotted, double, groove, ridge, and hidden borders routinely. css-backgrounds-3 §4.2 defines the styles; hidden behaves like none for layout but takes part in the border-collapse table model. This slice lands the remaining border styles as painted output with radius interplay.

## Requirements

- [ ] dashed and dotted borders paint per css-backgrounds-3 §4.2 (dash/dot lengths and gaps scaled from border-width) matching Chrome's raster within the pixel band.
- [ ] double borders paint as two lines with a gap per §4.2 (width < 3px renders as solid), matching Chrome.
- [ ] groove and ridge borders paint with Chrome's edge shading (inverse of ridge/groove per face) within the pixel band.
- [ ] hidden parses and computes to 'hidden' with layout equivalent to none but visible in border-collapse table contexts (computed-style parity).
- [ ] The new styles compose with border-radius (corners follow the rounded path) and with inset/outset lighting already implemented.
- [ ] Corpus under corpus/border-styles/ exercises each style at several widths and with border-radius; verify script scripts/verify-border-styles.mjs compares computed styles and non-text paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-border-styles.mjs exits 0 — computed styles match Chrome and non-text pixels are within the ΔE≤2/≤1% band for every fixture. Existing border-radius corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not change border geometry/layout for the new styles — border-width still contributes to the box model identically; only the painted decoration differs.
- Do not implement border-image — that is a separate feature and out of scope here.
- Do not regress solid/inset/outset painting or the border-radius interplay (corpus/border-radius must stay green).
- Do not implement grooved/ridged lighting with made-up shading — reproduce Chrome's raster within the pixel band or record a declared divergence.
- Do not add double borders whose inner gap math diverges from css-backgrounds-3 §4.2 (the two lines split the border-width with a gap where width ≥ 3px).
