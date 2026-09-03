---
wait_human_start: false
wait_human_merge: false
dependencies: [tables-border-collapse]
---

# Task: Quality-audit recursion chain, generation 1 of 5 — full re-verification at post-border HEAD; spawn generation-1 fixes and generation-2 audit

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Anchor of the quality-audit recursion chain (generation 1 of 5). Generation 0 (2026-09-03, at 0180452) produced docs/ledgers/quality-audit.md — the findings registry (QA-01..QA-15), the binding loop protocol, and the attempt log — from a full code/ledger/architecture analysis (three parallel module deep-dives, spot-verified; prior review pair docs/review-honest-assessment.md + docs/review-response.md folded in). You run AFTER tables-border-collapse lands, so the tables-adjacent findings need re-verification against the moved tree. Your job: re-verify the registry at HEAD, disposition each finding, spawn the highest-severity fixes as self-contained tasks, and create generation 2 — carrying forward everything touched and everything attempted. You are the heartbeat of a single-agent loop: if you create no successor, the chain dies. Read docs/ledgers/quality-audit.md §"Loop protocol" first; it binds you and every task you create.

## Requirements

- [ ] Read docs/ledgers/quality-audit.md (registry + protocol + attempt log) and the two review docs for known history. Run `git log --oneline 0180452..HEAD` and build the touched-areas list for this generation (expect tables-border-collapse plus any chain fixes that landed: verify-gate-coverage, charter-deferred-enforcement, safari-config-fix).
- [ ] Re-verify at HEAD, with file:line evidence, at minimum: QA-01 (block-inline⇄tables import cycle + setTableAvailableInlineSize side-channel + split-brain table UA defaults — expect movement from the border work), QA-02 (quadruplicated intrinsic-sizing helpers and their five drift axes; dead `minimum` field), QA-06 (sRGB coefficient drift — verify-first: may be an intentional Blink-port vs comparison-space difference), QA-09 (cascade parse-helper duplication family), QA-10 (monoliths + display-skip-list ×4 + module globals). Update every registry row: open / fixed / disproven / drifted-further, with evidence.
- [ ] Create at most 2 fix tasks this generation for the highest-severity verified findings (suggested: QA-01 then QA-02; skip any the registry marks disproven or retired). Each fix task embeds: the protocol verbatim, the re-verify-first requirement, the touched-areas list, the relevant attempt-log entries, one-context-window scope, runnable verification (build + named verify gates + check-charter), the honest no-issue completion path (record disproof in the ledger, change nothing), and wait_human_start/merge false. A fix task may create at most 3 tasks itself (successor audit excluded from that count — see protocol §3) and never spawns a second audit chain.
- [ ] Create exactly one successor task `quality-audit-2` (generation 2 of 5, wait_human_start/merge false, dependencies on the fix tasks you created this generation) whose spec embeds: the protocol verbatim, the updated registry summary, the touched-areas list, the full attempt log (so no approach is repeated blind), and the size-slices-so-gates-pass lesson from history (breaker path needed 3 attempts; tables-layout first archived PARTIAL).
- [ ] Update docs/ledgers/quality-audit.md: statuses, attempt counts, touched-areas log entry for generation 1, any new findings registered with severity + evidence. Commit the ledger update. If a finding cannot be fixed this generation, it must still be dispositioned here — no silent drops.
- [ ] Obey the protocol's hard rules exactly: worktree-only; never touch .orchestration/, tmp/, /tmp, or anything outside the worktree; never invoke the orch CLI from a shell; never git push; no scratch files; no permission-prompting actions (operator unavailable); commit everything and leave the tree clean.

## Verification

docs/ledgers/quality-audit.md updated at HEAD with generation-1 dispositions (every registry row re-verified or explicitly deferred with reason), a touched-areas entry, and an attempt-log row per attempted finding. tasks/quality-audit-2/task.md exists, is generation 2 of 5, carries the protocol verbatim, and depends on this generation's fix tasks; every created task has wait_human_start: false and wait_human_merge: false. No more than 3 tasks created total. npm run build and node scripts/check-charter.mjs exit 0 (the audit makes no product-code changes; if it touched none, the gates still run and pass).

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no `orch` CLI from a shell; no git push; no scratch files (temp files under docs/reports/ only, deleted before finish) — permission prompts cannot be answered, the operator is unavailable.
- No more than 3 created tasks total (fix tasks + the single successor audit); no second audit chain; no successor at all if generation N > 5; no created task with wait_human_start or wait_human_merge true.
- No product-code changes in the audit itself (it verifies, dispositions, and spawns — fixes belong to the spawned tasks); no gate weakening: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers, no disabled verify scripts.
- No silent drops: a finding may not vanish — it is open, fixed, disproven (with evidence), retired (≥10 attempts), or registered for the next generation, always in the ledger.
