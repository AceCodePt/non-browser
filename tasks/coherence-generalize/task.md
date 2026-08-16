---
wait_human_start: false
wait_human_merge: false
dependencies: [font-registration-gaps, flexbox-baseline-authority, flexbox-wrap-reverse, strip-what-comments]
---

# Task: Generalize the single-authority patterns and standardize cross-module coherence

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Down-the-line coherence pass, from the request "generalize even further, standardize down the line, to make sure everything is coherent" — interpreted as: generalize the single-authority patterns the parity slices establish and standardize so every mechanism has exactly one owner. NOTE: this scope is an interpretation; amend this spec (update_task) before dispatching if a different generalization was meant (e.g. multi-browser breadth — that belongs in browser-canvas-support). Runs last, after the slices and the comment pass, so it consolidates on a clean tree.

## Requirements

- [ ] Audit src/ for repeated formulas and constants; route each through its single authority and eliminate every cross-module duplication (grep-auditable).
- [ ] One font-resolution authority: every measurement/paint/seam path resolves CSS families through resolveFontFamily for the active browser-config; grep confirms no path bypasses it.
- [ ] One baseline authority: flexbox, block-inline, paint, and the Pretext seam all derive baselines from the shared fontmetrics authority; no module carries its own ascent/descent constants.
- [ ] A single line-breaking/wrapping authority if a line-breaking slice has landed; otherwise the task documents where the seam-vs-shipped divergence sits (parity.md Honest Reading item 3).
- [ ] Charter §4 and the ledgers updated so every claim matches the post-slice engine; check-charter green.
- [ ] All existing verifiers stay green after consolidation — this is a pure refactor plus docs.

## Verification

npm run verify green (or the subset the task name triggers) after consolidation. Grep audit passes: exactly one definition each of font-resolution entry, baseline math, and (if landed) line breaking; no module bypasses them. check-charter green.

## Prohibited Patterns

- Do not change runtime behavior — consolidation/standardization refactor only, verified by unchanged verify results.
- Do not weaken or re-scope charter tolerances to fit the refactor.
- Do not fold in new features (e.g. Safari breadth) unless this spec is amended — that belongs to browser-canvas-support.
