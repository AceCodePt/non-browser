---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Harness-Tolerances

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The tolerance/diff tooling that turns "parity" into a measurable, reportable quantity: per-layer tolerance config, delta-E computation, region masking (text-only masks for paint), and a per-layer report artifact. Formalizes the harness knobs the spine left as placeholders. Owning module harness/, and the shared verify:report script.

## Requirements

- [ ] Per-layer tolerance configuration (JSON) with charter defaults: measureText sub-pixel, getComputedStyle exact, rects <=0.5px, screenshot delta-E <=2 with <=1% pixels exceeding
- [ ] Delta-E computation between our pixel buffer and the Chrome screenshot (per-pixel color distance) plus percent-exceeding metric
- [ ] Region masking: per-fixture mask files that exclude known-divergent regions (e.g. antialiased glyph edges) from the pixel diff while keeping all other pixels strict
- [ ] Report artifact: npm run verify:report renders a corpus set and writes a per-layer pass/fail report (counts, worst delta, thresholds) to docs/reports/<timestamp>/
- [ ] Tolerance changes are versioned and default to the charter values
- [ ] A regression fixture demonstrates a deliberate small divergence is caught (fail) and one is masked (pass)

## Verification

`npm run verify:report` exits 0 and writes a per-layer report for a fixture set; the regression-fixture check asserts the unmasked divergent case fails and the masked case passes.

## Prohibited Patterns

- Do not change any task's corpus fixtures to make diffs pass — fix tolerances/reporting only
- Do not weaken charter tolerances without recording the change in docs/ledgers/tolerances.md
