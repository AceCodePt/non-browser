---
wait_human_start: true
wait_human_merge: false
dependencies: []
---

# Task: Task: Audit all 42 archived tasks for empty/partial execution and record the classification

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The typed-gap harness lets `npm run verify` pass on unchanged code (known-gaps fixtures assert their divergences STILL exist), so tasks can be archived without executing. Proven cases: font-registration-gaps (archived empty; REDONE as font-registration-faces), hardening-core (parity.md Honest Reading #6: "archived with no code changes — all ten requirements remain open"), and pretext-engine-path / text-breaker-parity (git shows only task.md moves; docs/ledgers/breakers.md is still a stub listing unlanded work). Before re-dispatching or re-scoping anything, audit every archive entry against git history and source evidence, and record the classification so redo/priority decisions are grounded in fact.

## Requirements

- [ ] For each archive/<name>/task.md entry, determine from git history (branch commits, merges, the 'orch: archive <name>' commit) and source evidence (grep for the task's owner tokens in src/, scripts/, corpus/) whether its requirements actually landed.
- [ ] Classify every entry EXECUTED / PARTIAL / EMPTY with one line of evidence, recorded in a new docs/ledgers/archive-audit.md (one row per archive entry).
- [ ] Cross-reference EMPTY/PARTIAL entries against the current tasks/ specs and the charter §11 coverage matrix; list which already have an owner (e.g. font-registration-faces) and which have none.
- [ ] No engine code changes — the deliverable is the ledger and the findings it enables.

## Verification

docs/ledgers/archive-audit.md exists with an entry per archive (status + evidence line). The EMPTY list includes at least font-registration-gaps, hardening-core, pretext-engine-path and text-breaker-parity and is consistent with the git evidence. npm run build still passes (no code changed).

## Prohibited Patterns

- Do not delete or edit archive/ specs — the audit is read-only over them.
- Do not execute the audited tasks inside this task — audit + ledger only.
- Do not change engine behavior or runtime code.
