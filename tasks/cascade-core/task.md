---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Cascade-Core

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The core cascade: selector matching against the parse5 DOM tree, specificity ordering, source order, inheritance, the UA stylesheet, and initial values. Computed styles are the oracle's layer-2 contract. The spine established cascade as a phase pipeline; this task owns cascade/phases/core.ts and must not collide with sibling phase modules.

## Requirements

- [ ] Selector matching over the parse5 DOM: type, class, id, attribute, descendant/child, sibling, and compound selectors; specificity computed per CSS spec
- [ ] Cascade ordering: origin (UA < author), specificity, then source order; inline styles highest origin in author scope
- [ ] Inheritance for inherited properties (color, font-*, text-align, etc.) with explicit values overriding inherited ones; initial values for non-inherited properties
- [ ] Minimal UA stylesheet matching Chrome's (display mappings for common tags, margins for p/ul/ol/headings, etc.) verified via getComputedStyle
- [ ] Computed-value pipeline: keywords -> resolved lengths/colors/percentages as far as cascade-core needs (percentages/em resolved later in layout where the context exists)
- [ ] Corpus corpus/cascade-core/ with specificity, inheritance, and UA fixtures; npm run verify:cascade-core exits 0 with exact getComputedStyle equality vs Chrome

## Verification

`npm run verify:cascade-core` exits 0: for every corpus/cascade-core fixture, computed styles of all nodes match Chrome exactly (layer-2 oracle).

## Prohibited Patterns

- Do not implement custom properties, layers/!important, or media queries here — those are separate phase modules owned by sibling tasks
- Do not modify sibling phase files (custom-props, layers-important, media-queries)
