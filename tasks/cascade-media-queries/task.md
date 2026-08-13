---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Cascade-Media-Queries

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Media/container queries against the viewport input, and viewport units. A static renderer evaluates @media once per viewport — deterministic, no resize concerns. @container needs container-type/comtainer-name plumbing that layout later provides; this task establishes the evaluation model and the fixtures that need only viewport-relative media. Owning module cascade/phases/media-queries.ts, corpus/media-queries/.

## Requirements

- [ ] @media condition evaluation against the viewport input: width/height/min/max, aspect-ratio, prefers-color-scheme, prefers-reduced-motion, orientation, resolution, and compound conditions with and/or/not
- [ ] Media rules gate rule application: rules inside a false query are excluded from the cascade; true queries contribute normally
- [ ] Viewport units (vw, vh, vmin, vmax) resolve against the viewport input at computed-value time
- [ ] @container: implement evaluation for width/height queries when container-type/container-name are present; otherwise document the gap in the ledger with concrete examples
- [ ] Corpus corpus/media-queries/ rendered at multiple viewports and compared to Chrome at the same viewport sizes; npm run verify:media-queries exits 0 with exact getComputedStyle equality

## Verification

`npm run verify:media-queries` exits 0: for each fixture x viewport combination, computed styles match Chrome at that viewport (layer-2 oracle).

## Prohibited Patterns

- Do not evaluate @media against a live browser surface — evaluate against the viewport input
- Do not implement @container without container-type/name plumbing from layout; if unimplemented, fixtures must be authored to prove it is a documented gap, not silently wrong
