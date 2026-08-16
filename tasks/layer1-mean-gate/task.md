---
wait_human_start: true
wait_human_merge: false
dependencies: [text-tier-verifiers]
---

# Task: Task: Enforce the layer-1 mean tolerance (≤ 0.01px) where the charter requires it

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

parity.md Honest Reading #2: verify-four-layer.mjs gates the Pretext seam on maxPx ≤ 0.5px only; the charter's <0.01px mean is computed and reported but never checked (basic-text's seam mean 0.0117px is over the band yet the run is green). verify:text-measure likewise reports the pass-corpus mean without failing a per-category mean breach. Enforce the charter's mean wherever the charter requires it, or amend the charter with a recorded tolerance entry — no unenforced tolerance band.

## Requirements

- [ ] Enforce the ≤ 0.01px mean in verify-four-layer.mjs seam gating and per-category means in verify-text-measure.mjs; a breach fails the run.
- [ ] If a fixture cannot honestly meet the mean under the current engine, amend tolerances.json + tolerances.md with a recorded entry (version bump) rather than leaving the band unenforced.
- [ ] Keep the maxPx ≤ 0.5px gate unchanged.

## Verification

npm run verify:four-layer and npm run verify:text-measure exit 0 with the mean check wired in (grep shows the mean gate in both scripts). Any amended tolerance is recorded in tolerances.md with a tolerances.json version bump.

## Prohibited Patterns

- Do not silently drop the mean check.
- Do not weaken the maxPx ≤ 0.5px gate.
- Do not change tolerances without a tolerances.md entry and tolerances.json version bump.
