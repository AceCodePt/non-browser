---
wait_human_start: false
wait_human_merge: false
dependencies: [text-mask-parity]
---

# Task: Opacity-Compositing

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. Element-level opacity is extremely common (disabled states, hover fades, overlay dims) and the engine only supports per-color alpha (ComputedStyle.backgroundColor/color with a), not a box-level opacity that composites an entire subtree. A div with opacity:0.5 and a child with its own color paints wrong at every overlapping pixel at layer 4. opacity:0 (or <1) also creates a stacking context per css-transforms-1, which interacts with the existing z-index work.

## Requirements

- [ ] opacity parsed into ComputedStyle (0..1, clamping) with computed value matching Chrome's getComputedStyle
- [ ] An element with opacity<1 composites its whole subtree (background, borders, children, text) at that alpha against what's behind it, matching Chrome's raster within the charter §4 screenshot band
- [ ] opacity:0 hides the subtree's paint while keeping layout/rects intact (invisible but occupying space), matching Chrome
- [ ] opacity<1 establishes a stacking context: the element paints atomically and a negative-z-index descendant does not escape it, verified against Chrome's stacking
- [ ] Corpus corpus/opacity/ with four-layer fixtures (faded box over background, overlapping children at 0.5, opacity:0 preserving layout, stacking-context z-index interaction) and npm run verify:opacity exiting 0 against Chrome per charter §2/§4

## Verification

npm run build passes. npm run verify:opacity exits 0: composited opacity fixtures match Chrome's pixels within the screenshot band, opacity:0 keeps rects but paints nothing, and the stacking-context fixture paints as Chrome does. Existing verify scripts remain green.

## Prohibited Patterns

- Do not implement opacity by flattening it into each color's alpha - that breaks overlapping children and the stacking context semantics
- Do not ignore that opacity<1 (and opacity:0) establishes a stacking context (css-transforms-1 §3); a negative z-index child must not render beneath an opaque-opacity ancestor
- Do not composite at 8-bit lossy precision that diverges from Chrome's compositing within the screenshot band
