---
wait_human_start: false
wait_human_merge: false
dependencies: [overflow-clip-rect, calc-values]
---

# Task: Task: direction:rtl logical start/end box layout across block, floats, grid, flex, and positioning

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The measure corpus proves RTL text measures sub-pixel, but box layout is LTR-only: no direction:rtl handling for start/end mapping across block/inline, floats, grid, absolute insets, or flex/grid logical axes (flexbox has row-reverse but not logical direction). An Arabic/Hebrew document is laid out wrong regardless of text measurement. Add logical start/end resolution from computed direction across the layout modules, matching Chrome rect parity (layer 3). Depends on overflow-clip-rect and calc-values so the block-inline.ts and css.ts edits serialize.

## Requirements

- [ ] Parse direction:ltr/rtl (css-writing-modes-4) and resolve logical start/end for box edges: block inline-start/end, margins/padding/insets (incl. inset-inline-start/end), float placement, grid/flex main and cross start, and absolute positioning start/end.
- [ ] text-align: start/end (css.ts:205) stays consistent with the box edges under the same direction.
- [ ] New corpus (corpus/rtl-layout/) with rtl paragraphs, rtl floats, rtl grid, rtl flex, and mixed ltr/rtl nesting; rect deltas vs Chrome within layer-3 tolerance.
- [ ] check-charter green with rtl rows.

## Verification

npm run build passes. verify:layout-{positioning,floats,grid,flexbox} exit 0; rtl-layout fixtures report rect max Δ ≤ 0.5px vs Chrome. check-charter green.

## Prohibited Patterns

- Do not change RTL text measurement — that is measure-corpus scope.
- Do not weaken the layer-3 tolerance (≤ 0.5px per box).
- Do not hard-code per-fixture direction — resolution is from computed direction.
