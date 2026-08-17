---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Task: Overflow clip parity corpus + verify-overflow gate (code landed, fixtures/gate missing)

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

overflow-clip-rect landed the engine code — a rect clip path for square overflow (block-inline.ts:830 no longer gated on hasNonZeroRadius, driven by clipsContent) and overflow:clip/auto parsing (clipsContent/isScrollContainer in css.ts) — but was archived WITHOUT its corpus or gate: no corpus/overflow, no scripts/verify-overflow.mjs, so the new clipping is unverified by any fixture. The session-idle *overflow* case already runs `node scripts/verify-overflow.mjs` (missing) + verify:paint-text, and the hook's no-op guard now rejects empty work — so this task either lands the fixtures + gate or fails. No engine-code changes required unless a fixture exposes a real clip bug.

## Requirements

- [ ] New corpus (corpus/overflow/) with: a square overflow:hidden box clipping overflowing children (incl. a negative-margin child), overflow:clip (no scroll container), overflow:auto parsing that does not mis-layout, and a rounded overflow:hidden regression fixture (the pre-existing rounded path stays exact).
- [ ] scripts/verify-overflow.mjs renders each fixture engine-vs-Chrome and asserts layer-3 rect parity (≤ 0.5px per box) and layer-4 non-text screenshot parity (ΔE ≤ 2, ≤ 1% exceeding); exits non-zero when the corpus is absent or any fixture diverges — this IS the daemon's acceptance gate.
- [ ] The session-idle *overflow* case (already committed: `npm run build && node scripts/verify-overflow.mjs && npm run verify:paint-text`) runs the gate as-is.
- [ ] check-charter green: the overflow row's Tested column is extended (corpus/border-radius, corpus/flexbox) to include corpus/overflow.

## Verification

npm run build passes. node scripts/verify-overflow.mjs exits 0: every corpus/overflow fixture reports rect max Δ ≤ 0.5px and ≤ 1% screenshot pixels exceeding vs Chrome. npm run verify:paint-text green. node scripts/check-charter.mjs exits 0 with corpus/overflow in the overflow row's Tested column.

## Prohibited Patterns

- Do not change the landed clip code beyond what a fixture exposes as a real bug — this task proves parity, it does not re-engineer.
- Do not weaken the layer-4 tolerances (ΔE ≤ 2, ≤ 1% exceeding) or the layer-3 rect tolerance.
- Do not finish before scripts/verify-overflow.mjs and corpus/overflow/ exist — the *overflow* gate and the hook's no-op guard reject empty work.
- Do not mask a divergence — if a fixture clips differently from Chrome, the divergence must be fixed or recorded as a typed gap, not excluded.
