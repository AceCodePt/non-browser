---
wait_human_start: false
wait_human_merge: false
dependencies: [gap-fixture-schema]
---

# Task: Coverage-Matrix-Sweep

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Improvement-plan §3 (docs/improvement-plan.md). Breadth vs depth: grid.ts is 1379 lines, flexbox.ts 989, corpora are small (13 grid, 24 flexbox, 9 paint-text fixtures), DPR is effectively pinned at 1 (no dpr/devicePixelRatio symbol in src/), and the per-browser fallback-table machinery is near-dead (src/config/chrome.ts is 22 lines, firefox.ts 41; no corpus resolves a multi-family fallback TABLE). Corrected fact: measure-corpus DOES exercise 11 families (DejaVu Sans, Droid Arabic Kufi, Droid Sans Devanagari, Droid Sans Fallback, Droid Sans Hebrew, Droid Sans Japanese, Liberation Mono/Sans/Serif, Noto Sans, Source Code Pro) at 82/82 strings mean Δ ~0.0016px - so per-family single-face measurement is well covered. What is NOT exercised: cross-family LAYOUT (CSS font stacks, fallback resolution during layout) and the fallback-table machinery itself. Without an explicit coverage statement, "grid parity" overpromises.

## Requirements

- [ ] Coverage matrix in the charter: a table enumerating the supported properties per feature (flex: grow/shrink/basis, wrap, align/justify, gaps; grid: fr/minmax/repeat/auto-flow/dense/alignment; block/inline: width/margins/padding/floats/positioning; text: white-space, letter-spacing, decorations) with an implemented column and a tested (corpus-covered) column
- [ ] check-charter.mjs enforces the coverage matrix's presence and consistency so the charter and the corpus cannot drift apart silently
- [ ] A programmatic value-sweep script generates fixtures by sweeping property/value combinations (e.g. flex-wrap x justify-content x align-items; grid-template x gap) and diffs all four layers against Chrome, producing breadth without hand-authoring hundreds of fixtures
- [ ] The sweep results land in a corpus (e.g. corpus/sweep-*) and a verify script exits 0 on the swept set, with any known divergence documented in a ledger rather than silently excluded
- [ ] Cross-family LAYOUT + fallback-table corpus: fixtures whose CSS font stacks resolve through browser-config fallback tables (using faces already on disk: Liberation Serif, Source Code Pro, Droid Sans Fallback) exercise resolveFontFamily at layout time, not just per-string measurement, so chrome.ts/firefox.ts configs are actually exercised

## Verification

npm run build passes. docs/charter.md contains the coverage matrix and `node scripts/check-charter.mjs` exits 0 on it. The value-sweep script runs and its verify script exits 0 on the swept fixtures (corpus/sweep-* present, four-layer diffed). Cross-family fallback fixtures exist, run green, and at least one exercises resolveFontFamily through a non-trivial fallback (e.g. a stack that lands on Source Code Pro via the firefox table or a multi-family stack in layout).

## Prohibited Patterns

- Do not duplicate per-family single-face measurement - that already exists in measure-corpus at 82/82; target fallback tables + cross-family layout instead
- Do not weaken tolerances or fake coverage rows to pass
- Do not add 'more families' without a fixture that actually resolves a CSS font stack or a fallback table
- Do not hand-author hundreds of fixtures; the value-sweep must be programmatic
