---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Task: CSS property-coverage audit — report recognized vs silently-ignored declared properties

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

makeStyle (src/layout/css.ts) reads declared properties by name (decls.find(d => d.property === 'X')) and silently ignores anything it does not look up. An unsupported or misspelled property — transform, var(), outline, text-transform, an unhandled shorthand, a typo — is dropped with no error, no warning, and no coverage signal, while Chrome would apply (or reject) it, so parity can silently diverge without any fixture noticing. There is also no ledger of which declared properties the engine recognizes vs ignores, so you cannot tell whether a real component's CSS is being honored or stripped. This task adds a property-coverage audit: a probe/report (not a behavior change) that tallies recognized vs ignored declared properties per render, surfaces silently-dropped properties as data, and can be gated to fail when a whitelist of unsupported-but-likely properties is declared. Independent of container-query-layout (different file) and the stress-corpus task (which will benefit from this audit to measure variety coverage).

## Requirements

- [ ] Track, per rendered declaration block, which declared CSS properties the engine recognized/consumed vs ignored (not looked up by makeStyle's property table). Expose recognized and ignored property names with counts.
- [ ] A probe (or verify script, e.g. node probes/probe-property-coverage.mjs or scripts/verify-property-coverage.mjs) that renders the corpus (and optionally a given HTML string) and reports: the full set of declared properties, the recognized subset, the ignored subset, and the union across fixtures.
- [ ] Surface silently-dropped likely-real properties (transform, var(), outline, text-transform, overflow-wrap/word-break, background-image, transition, etc.) as data rather than swallow them — a coverage ledger (docs/ledgers/property-coverage.md) records which are ignored and why (not-implemented vs unsupported-value).
- [ ] A whitelist of 'supported' properties the engine asserts it handles; declaring any property outside the supported set on a fixture fails the audit (so new ignored properties must be accounted for, not silently added).
- [ ] check-charter green and the full verification suite stays green (audit-only: zero behavior change).

## Verification

npm run build passes. node scripts/verify-property-coverage.mjs (or equivalent) exits 0 and produces a property-coverage ledger listing the recognized set, the ignored set, and per-property reason; a fixture declaring a property outside the supported whitelist fails the audit. The full verify suite is unchanged (audit-only). check-charter green.

## Prohibited Patterns

- Do not change engine behavior — this is an audit/visibility deliverable first (a later task may implement missing properties).
- Do not invent new tolerances or weaken existing gates to accommodate unsupported properties.
- Do not special-case per fixture — the audit is generic over all declared properties.
- Do not hide unsupported properties — they must surface as report/count data, not be swallowed.
