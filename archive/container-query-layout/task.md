---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Task: @container layout plumbing — compute container sizes and apply container queries (flip the documented gap to pass)

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The @container gap is the project's one declared resolution error with an established container. src/cascade/phases/media-queries.ts already has the full evaluation model — parseContainerPrelude, ContainerGroup, evaluateContainerCondition with range syntax (width/aspect-ratio), and container-type/container-name parsing — but the layout plumbing that computes actual container sizes does not exist. media-queries.ts:159-163 explicitly parses @container rules then `continue`s past them ("container sizing is provided by layout in a later task"). The typed-fail fixture corpus/media-queries/container-gap proves the divergence: .wrap establishes a container (container-type: inline-size, width 400px), Chrome's @container (min-width:100px) matches and paints #child red, while the engine never applies the rule. This task lands the layout plumbing so @container rules actually apply, then flips the fixture to pass. Independent of the property-coverage and stress-corpus tasks (different files: layout + media-queries phase + the container-gap fixture).

## Requirements

- [ ] Layout computes container sizes for elements that establish a container: resolve container-type (v1: inline-size; document full size/block-size as not-yet), and for each @container rule resolve the nearest qualifying ancestor container-name chain (container-name match) whose content-box size feeds evaluateContainerCondition.
- [ ] Wire the applied @container rules into the cascade over the (potential) containers computed by layout, so min-/max-width, exact, and range-syntax width conditions on an established container actually match — matching Chrome.
- [ ] The engine path: container-gap flips from a typed-fail to pass — Chrome and the engine both paint #child per the @container condition at both harvest viewports (600x400 and 800x600).
- [ ] Add coverage so @container is corpus-tested, not just the one gap flip: at least one nested-container and one non-matching-container case alongside the flipped container-gap.
- [ ] check-charter green: the media-queries row Tested column gains corpus/media-queries container coverage, and the container-gap typed divergence is removed with a ledger update in docs/ledgers/media-queries.md.
- [ ] A session-idle gate maps *container*/*media* task names to the media-queries verifier (existing *media* case) — verify the tuned run passes.

## Verification

npm run build passes. npm run verify:media-queries exits 0 with container-gap now PASS (no typed-fail declaration) and the new container fixtures pass computed-style exact-equality at both viewports. node scripts/check-charter.mjs exits 0. docs/ledgers/media-queries.md records the @container-inline-size scope and the resolved divergence.

## Prohibited Patterns

- Do not fork or re-implement the existing evaluation model in phases/media-queries.ts — consume parseContainerPrelude/ContainerGroup/evaluateContainerCondition.
- Do not weaken the layer-2 computed-style exact-equality gate.
- Do not delete the container-gap fixture before its divergence closes — flip it to pass only once @container applies.
- Do not silently drop unsupported container-type values in a way that changes behavior — document the v1 scope (inline-size + container-name; full size()/block-size documented, not implemented).
