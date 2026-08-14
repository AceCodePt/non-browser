---
wait_human_start: false
wait_human_merge: false
dependencies: [pretext-engine-path]
---

# Task: Gap-Fixture-Schema

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Improvement-plan §4 (docs/improvement-plan.md). The gate itself is sound (a declared expected:fail that closes FAILS the run - src/harness/evaluate.ts:163-167, verify-media-queries.mjs:151, verify-text-measure.mjs:154-161 all assert the divergence still exists), so the rationale must NOT be rewritten as "gaps pass silently". What is weak: (a) two schema forms exist for expected - corpus/measure-corpus/known-gaps uses a top-level string "fail" while corpus/media-queries/container-gap and corpus/harness-tolerances/regression-divergence use per-layer objects; (b) the reason and any sunset live only in prose (fixture notes + ledger sections), so nothing enforces that a gap has an owner and an expiry. Three fixtures currently declare expected:fail.

## Requirements

- [ ] One typed per-layer expected schema replaces the two current forms: the corpus/measure-corpus/known-gaps top-level string "fail" shorthand is converted to the same per-layer object shape the other fixtures use (or is explicitly validated to mean 'all layers fail' in the schema)
- [ ] Every fixture that declares expected:<layer>:fail carries typed reason and sunset fields (e.g. a reason string referencing the ledger/note and a sunset condition - a commit, a date, or a spec feature landing), so a gap has an owner and an expiry as data, not prose
- [ ] A verify/check step (check-charter.mjs or a harness-level check) fails when any expected:fail fixture lacks typed reason+sunset
- [ ] docs/ledgers/parity.md or equivalent trends the gap count so it can move toward zero, listing the reason/sunset per gap
- [ ] The harness (src/harness/fixtures.ts types + evaluate.ts) accepts only the single typed per-layer expected form

## Verification

npm run build passes (tsc strict). npm run verify exits 0. grep across corpus/ shows every fixture declaring expected:fail uses the single typed per-layer form with reason+sunset present. The check step fails (exit non-zero) when a reason or sunset is removed from a gap fixture. verify:media-queries and verify:text-measure still pass with the container-gap and known-gaps fixtures under the normalized schema.

## Prohibited Patterns

- Do NOT weaken or remove the existing closed-gap gate - a closed expected:fail must keep failing the run so gaps get reclassified
- Do not delete the reason prose or ledger references when adding typed fields
- Do not move fixtures out of their feature corpora; consolidation is optional and must not break the per-feature verify scripts
- Do not change tolerances.json to make anything pass
