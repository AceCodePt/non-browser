---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Fix flex-wrap: wrap-reverse cross-axis line ordering

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

All 20 flex-wrap-reverse sweep fixtures diverge 30–31px on rect (screenshot 21.8–24.0% exceeding) — every justify-content/align-items combination except baseline/center (docs/ledgers/sweep.md). The engine isn't laying lines along the reversed cross axis (cross-start at the bottom for row direction) or is miscomputing per-line cross positions. wrap-reverse is the largest single class of geometry divergence in the corpus (20 of 36 sweep gaps).

## Requirements

- [ ] wrap-reverse lays lines out from the opposite cross edge (cross-start = bottom for row direction, right for column) with correct per-line cross positioning for align-content stretch/flex-start/flex-end/center.
- [ ] Item cross positions within each line respect wrap-reverse (cross-end at the top/left), matching Chrome's rects for all 20 fixtures.
- [ ] Flip all 20 wrap-reverse sweep fixtures to pass: remove their typed gaps, rect max Δ ≤ 0.5px, screenshot exceed ≤ 1%.
- [ ] Update docs/ledgers/sweep.md and parity.md gap counts (30 → 10).

## Verification

npm run build passes. npm run verify:sweep green with all 20 wrap-reverse fixtures passing (gap count 30 → 10). npm run verify:layout-flexbox green. Grep confirms no wrap-reverse sweep fixture retains a typed gap.

## Prohibited Patterns

- Do not fix baseline combos here — flexbox-baseline-authority owns those.
- Do not mask the wrapped-region pixels or weaken tolerances to pass.
- Do not special-case individual fixtures; the fix must be general across all wrap-reverse combos.
