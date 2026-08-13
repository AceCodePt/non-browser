---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Cascade-Layers-Important

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

!important, cascade layers (@layer), and origin ordering — the cascade ordering refinements above plain specificity/source-order. Chrome (Blink) has subtle layer-ordering rules that affect computed styles. Owning module cascade/phases/layers-important.ts, corpus/layers-important/.

## Requirements

- [ ] !important flips the cascade: important author beats normal author; important UA origin ordering per spec
- [ ] @layer ordering: layered vs unlayered styles, layer declaration order, layer ordering with specificity only as tiebreak within a layer, layered !important reversing layer order per spec
- [ ] Origin precedence fully implemented: UA normal < author normal < author important < UA important (user origin out of scope, document that)
- [ ] Corpus corpus/layers-important/ (important vs specificity, layered vs unlayered, multiple @layer blocks, nested layers as supported by Blink); npm run verify:layers-important exits 0 with exact getComputedStyle equality vs Chrome

## Verification

`npm run verify:layers-important` exits 0: all corpus/layers-important fixtures match Chrome's computed styles exactly (layer-2 oracle).

## Prohibited Patterns

- Do not touch sibling cascade phase modules or core.ts
- Do not approximate layer ordering — match Blink's @layer ordering including unlayered-vs-layered precedence
