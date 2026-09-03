---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: display: contents box suppression

## Metadata

- **Complexity:** Low
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

display: contents is absent — css.ts maps display values and unknown/out-of-list values fall to 'block' (css.ts:1453-1474), so display: contents would render as a block box, diverging from Chrome where the element generates no box and its children participate in the parent's formatting. css-display-3 §2 defines it. The rect contract matters here: Chrome's getBoundingClientRect on a display:contents element returns all zeros. This slice is small and self-contained.

## Requirements

- [ ] display: contents computes to 'contents' (getComputedStyle parity) and generates no box: no background/border/padding/margin paint, no layout contribution.
- [ ] Children of a display: contents element lay out directly in the grandparent's formatting context, matching Chrome's rects (block children in a block parent, flex items in a flex parent, grid items in a grid parent).
- [ ] The rect contract: an id'd display: contents element maps to an all-zero rect like Chrome, and the verify:rect-contract gate stays green.
- [ ] display: contents on a replaced element (img) is ignored like Chrome (replaced elements cannot be contents).
- [ ] Corpus under corpus/display-contents/ exercises block, flex-item, grid-item, and nested contents cases; verify script scripts/verify-display-contents.mjs compares rects and computed styles against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-display-contents.mjs exits 0 — children rects and the contents element's zero-rect match Chrome for every fixture. verify:rect-contract stays green. Existing inline-block corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not let display: contents generate a box — the element must produce no background, border, padding, or margin and its children participate in the parent's formatting context.
- Do not drop the element's children from layout — children (including block children) lay out as if the contents element were not there.
- Do not special-case only block contexts — display: contents must work inside flex and grid containers too (children become flex/grid items).
- Do not claim a display: contents element's own rect as a real rect — match Chrome: getBoundingClientRect returns all zeros (the rect contract must totalize it as zero, not throw).
- Do not regress inline-block/block/inline display handling (corpus/inline-block must stay green).
