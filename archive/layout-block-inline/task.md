---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Layout-Block-Inline

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Foundational layout: the box model, block formatting context, inline formatting (line boxes, text flow), margins and margin collapsing, auto/percentage widths, and inline-block. Everything else (floats, positioning, flex, grid) builds on this engine. The spine's minimal block-text layout is replaced/expanded here. Owning module layout/block-inline.ts, corpus/block-inline/.

## Requirements

- [ ] Box model: content/padding/border/margin boxes, box-sizing, width/height auto/percentage and min/max sizing, overflow
- [ ] Block formatting context: block stacking, margin collapsing (adjacent siblings, parent-child, negative margins), clear fix not required yet
- [ ] Inline formatting: line boxes, text flow via the Pretext breaker, inline boxes, vertical alignment baseline, white-space handling, letter-spacing
- [ ] Corpus corpus/block-inline/ of block/inline fixtures using inline styles; npm run verify:layout-block-inline exits 0 with rects <=0.5px (layer-3) and screenshot delta-E <=2/<=1% (layer-4) vs Chrome

## Verification

`npm run verify:layout-block-inline` exits 0: all corpus/block-inline fixtures match Chrome on layer-3 (getBoundingClientRect <=0.5px) and layer-4 (screenshot within tolerance).

## Prohibited Patterns

- Do not implement floats/positioning/flex/grid in this task; leave clean extension points
- Do not hand-roll text wrapping — reuse the Pretext-backed line breaking from the spine
