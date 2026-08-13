---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Layout-Grid

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

CSS Grid — deliberately the last layout feature (agreed in grilling: block/inline, floats, positioning, flex, then grid). Grid is the most complex formatting algorithm to match pixel-exact against Blink. Owning module layout/grid.ts, corpus/grid/.

## Requirements

- [ ] Grid container: grid-template-columns/rows with all unit types (px, fr, minmax, auto, fit-content, percentage, repeat()), grid-template-areas and named lines as supported by Blink
- [ ] Track sizing algorithm matching Blink: intrinsic contributions, fr distribution, overflow safety, min/max track constraints
- [ ] Auto-placement: row/column auto flow, span, dense packing
- [ ] Item alignment: justify/align items/self/place, gap
- [ ] Corpus corpus/grid/ covering explicit/implicit tracks, areas, auto-flow, fr distribution, and alignment; npm run verify:layout-grid exits 0 with layer-3 rects <=0.5px and layer-4 screenshots vs Chrome

## Verification

`npm run verify:layout-grid` exits 0: all corpus/grid fixtures match Chrome on layer-3 and layer-4.

## Prohibited Patterns

- Do not touch sibling layout modules
- Do not ship an approximation of grid sizing — match Blink's track sizing (fr, minmax, auto, fit-content, percentage) and auto-placement
