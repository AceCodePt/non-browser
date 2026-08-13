---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Layout-Positioning

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Positioned boxes: relative, absolute, fixed; containing-block resolution; z-index stacking contexts; static-position fallbacks for abs-pos without offsets. Static rendering, so fixed positions resolve against the viewport input. Owning module layout/positioning.ts, corpus/positioning/.

## Requirements

- [ ] position: relative offsets without affecting in-flow layout
- [ ] position: absolute with containing block resolution (nearest positioned ancestor, else viewport), top/right/bottom/left, auto margins centering, and static-position fallback when offsets are auto
- [ ] position: fixed against the viewport input (no scrolling in scope)
- [ ] z-index stacking: positioned elements with z-index order and stacking contexts, matching Chrome's painted order for the fixtures
- [ ] Corpus corpus/positioning/ (abs positioning, containing blocks, fixed, z-index); npm run verify:layout-positioning exits 0 with layer-3 rects <=0.5px and layer-4 screenshots vs Chrome

## Verification

`npm run verify:layout-positioning` exits 0: all corpus/positioning fixtures match Chrome on layer-3 and layer-4.

## Prohibited Patterns

- Do not touch sibling layout modules
- Do not implement transform/create stacking contexts beyond what positioning requires
