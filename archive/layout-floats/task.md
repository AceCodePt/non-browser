---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Layout-Floats

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Floats: float placement, text/line boxes wrapping around floats, clear and clearance. A distinct formatting behavior layered on the block-inline engine. Owning module layout/floats.ts, corpus/floats/.

## Requirements

- [ ] Float placement (left/right), including in the presence of margins/padding and multiple floats
- [ ] Inline content wraps around floats with correct line-box shortening, matching Chrome's float intrusion
- [ ] clear: left/right/both with correct clearance computation (including margin-collapsing interaction with clearance)
- [ ] Corpus corpus/floats/ (single/multi floats, text wrapping, clear, negative margins); npm run verify:layout-floats exits 0 with layer-3 rects <=0.5px and layer-4 screenshots within tolerance vs Chrome

## Verification

`npm run verify:layout-floats` exits 0: all corpus/floats fixtures match Chrome on layer-3 and layer-4.

## Prohibited Patterns

- Do not touch layout/block-inline.ts internals — extend via the formatting-context interface
- Do not implement flex/grid float behavior (float within flex/grid items is not this task's scope)
