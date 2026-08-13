---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Layout-Flexbox

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Flexbox layout — the most-used complex layout for real pages. Flex direction/wrap, main/cross axis sizing, flex-grow/shrink/basis, justify/align, gap, and order. Verified against Chrome rect-by-rect. Owning module layout/flexbox.ts, corpus/flexbox/.

## Requirements

- [ ] Flex container properties: flex-direction (row/column/reverse), flex-wrap, justify-content, align-items, align-content, align-self, gap, order
- [ ] Item sizing: flex-grow, flex-shrink, flex-basis (including auto), min/max sizing constraints, percentage sizes, intrinsic sizing
- [ ] Edge cases: overflow behavior, wrapped lines, margin auto, nested flex, baseline alignment
- [ ] Corpus corpus/flexbox/ (layouts covering the above); npm run verify:layout-flexbox exits 0 with layer-3 rects <=0.5px and layer-4 screenshots vs Chrome

## Verification

`npm run verify:layout-flexbox` exits 0: all corpus/flexbox fixtures match Chrome on layer-3 and layer-4.

## Prohibited Patterns

- Do not touch sibling layout modules
- Do not approximate Blink's flex algorithm — match its sizing and stretching behavior exactly for the fixtures
