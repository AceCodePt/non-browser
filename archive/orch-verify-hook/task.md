---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Wire the session-idle verification hook

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Improvement-plan §5 (docs/improvement-plan.md). 18 of 95 commits are "orch: accepted without verification" because the daemon's verification hook is not wired: only .orchestration/hooks/session-idle.sample exists (ends with a deliberate `exit 1`), so `accept` currently means only "an agent said it was done". The full verify suite is ~111s wall-clock (Playwright-dominated), so the hook must run the feature-relevant subset per task rather than always the whole suite. .orchestration/README.md is explicit that the committed-on-base copy of the hook is the authority, and that a non-zero exit feeds output back to the agent for retry (up to verify.retryCap).

## Requirements

- [ ] A real .orchestration/hooks/session-idle exists (not just the .sample), is executable, and is committed on the base branch
- [ ] The hook dispatches the feature-relevant verify subset from the committed-on-base scripts by TASK_NAME / feature (e.g. a flexbox task runs npm run verify:layout-flexbox; a text task runs verify:text-measure; unknown/unmapped features fall back to npm run verify or a documented default)
- [ ] A green verify exits 0 and commits the task work (preserving the sample's commit block); a failing verify exits non-zero so the daemon feeds the output back and retries
- [ ] The hook never runs the full Playwright-heavy suite when a feature subset suffices, keeping the loop near the ~feature-script wall-clock, not the full-suite cost
- [ ] The repo's verify scripts all exit 0 when run against the current corpus so the hook can rely on them (any currently-red script is fixed or the hook maps around it explicitly)

## Verification

.orchestration/hooks/session-idle exists, is executable, and is committed on base (git ls-files + stat). Invoking it with a TASK_NAME mapped to a green feature verify script (e.g. TASK_NAME=layout-flexbox) exits 0 and leaves the work committed; invoking it with a feature whose verify fails exits non-zero with the script output on stderr. `npm run build` passes.

## Prohibited Patterns

- Do not make the hook always run the full verify suite without a feature-subset path - the point is per-task subsets
- Do not commit the hook only on a task branch - it must live on base to be authoritative
- Do not weaken tolerances or edit fixtures to make verify scripts green
