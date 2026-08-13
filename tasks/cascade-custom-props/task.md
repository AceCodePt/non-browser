---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Cascade-Custom-Props

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Custom properties and var() resolution: a cascade phase. Browsers resolve var() at computed-value time with inheritance through the tree, @property registration for syntax/initial/inherits, fallback values, and cycle detection. Owning module cascade/phases/custom-props.ts, corpus/custom-props/.

## Requirements

- [ ] Custom property declarations collected and inherited through the tree per CSS Variables spec (inherited by default, tokens substituted at computed-value time)
- [ ] var(--name) resolution with fallback var(--name, <fallback>); nested var() and var() inside calc() resolved in order
- [ ] @property registration: syntax, inherits, initial-value honored, matching Chrome's behavior for typed custom properties
- [ ] Cycle detection: circular var() references resolve to the guaranteed-invalid value like a browser
- [ ] Corpus corpus/custom-props/ (inheritance chains, fallbacks, nested var, @property, cycles); npm run verify:custom-props exits 0 with exact getComputedStyle equality vs Chrome

## Verification

`npm run verify:custom-props` exits 0: all corpus/custom-props fixtures match Chrome's computed styles exactly (layer-2 oracle).

## Prohibited Patterns

- Do not touch cascade/phases/core.ts or the layers/media sibling phase files
- Do not treat custom properties as ordinary properties in the cascade ordering — they are inherited at computed-value time per spec
