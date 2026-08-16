---
wait_human_start: true
wait_human_merge: false
dependencies: [shadow-paint]
---

# Task: Task: box-level opacity subtree compositing + stacking-context interaction (redo of the archived opacity-compositing)

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

archive/opacity-compositing/ was archived empty — the engine supports only per-color alpha (ComputedStyle.backgroundColor/color with a), not a box-level opacity that composites an entire subtree; disabled states, hover fades, and overlay dims diverge at layer 4 (the archived spec's own rationale). opacity<1 also creates a stacking context per css-transforms-1, which interacts with the shipped z-index/stacking-context work. This redo adds subtree compositing at paint, matching Chrome per layer-4 non-text tolerance. Depends on shadow-paint to serialize paint.ts edits.

## Requirements

- [ ] Parse and compute `opacity` in the cascade (ComputedStyle.opacity) and apply box-level alpha.
- [ ] Paint an element with opacity<1 by compositing its subtree (offscreen surface at the element's paint bounds) then blending at the element alpha, matching Chrome; opacity:0 drops the subtree from paint while still creating a stacking context.
- [ ] opacity<1 establishes a stacking context; z-index/stacking-context corpus fixtures match Chrome's z-order.
- [ ] New corpus (corpus/opacity/) with disabled-style, fade, overlay, nested-opacity, and opacity×z-index fixtures.
- [ ] check-charter green with opacity rows.

## Verification

npm run build passes. A verify:opacity script (wired into session-idle's *opacity* case) exits 0 with screenshot deltas within tolerance on the opacity corpus; stacking-context fixtures match Chrome's z-order. check-charter green.

## Prohibited Patterns

- Do not change per-color alpha behavior.
- Do not weaken layer-4 tolerances.
- Do not introduce skia-specific types into src/canvas/interface.ts.
