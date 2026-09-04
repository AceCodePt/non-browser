---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Wire the 9 unwired verify scripts into the gate; fix parity.md's "full verify" claim

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Finding QA-05 of docs/ledgers/quality-audit.md (generation 0 analysis at 0180452). The project's acceptance story is `verify:all`, but 9 verify scripts are not in it (verify-colors, verify-custom-properties, verify-legacy-removal, verify-measure-perf, verify-measure-persist, verify-paint-fallback, verify-paint-perf, verify-property-coverage, verify-rtl), and scripts/verify-rtl.mjs + scripts/verify-paint-fallback.mjs are wired into NO npm script at all. docs/ledgers/parity.md:24 still calls the 21-script `verify` subset "the full npm run verify". This is a gate-coverage hole: features can regress silently. Read the loop protocol in docs/ledgers/quality-audit.md §"Loop protocol" before starting — it binds you.

## Requirements

- [ ] Re-verify QA-05 against HEAD first: enumerate scripts/verify-*.mjs and cross-check each against package.json (verify:all + named scripts). Record the enumerated diff in the commit message. If the finding is disproven (everything already wired), record the disproof in docs/ledgers/quality-audit.md (attempt log) and finish — no manufactured changes, no silent drop.
- [ ] Wire every environment-independent verify-*.mjs into verify:all. For each of the 9, first read its header/env requirements: if a script needs environment the gate cannot provide (e.g. verify-paint-fallback's documented daemon-driven mode), wire it into a new documented tier (e.g. verify:extra) with one README sentence — it must be reachable from package.json either way; never leave a verify script unwired.
- [ ] Add npm entries for verify:rtl and verify:paint-fallback if missing.
- [ ] Fix docs/ledgers/parity.md:24 (and any sibling wording) so the gate description matches reality: `verify` is the fast subset, `verify:all` is the full gate. Wording only — never hand-edit the ledger's numbers; numbers change only from real runs.
- [ ] Update docs/ledgers/quality-audit.md: QA-05 status + attempt log row. This is a chain task but NOT the audit: create no successor audit. Create follow-up tasks (max 3 total, wait_human_start/merge false) only if you uncover an important new finding; register lesser ones in the ledger instead.
- [ ] Obey the loop protocol verbatim (docs/ledgers/quality-audit.md §Loop protocol): worktree-only, no .orchestration/ or tmp/ or /tmp access, no orch CLI, no git push, no scratch files, commit everything, leave the tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0. npm run verify:all exits 0 — now including the newly wired scripts. A shell enumeration proves closure: every scripts/verify-*.mjs filename appears in package.json (directly or via the documented tier) and the two previously unwired scripts have npm entries.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no `orch` CLI from a shell; no git push (permission prompts cannot be answered — the operator is unavailable).
- No weakening of gates: do not edit tolerances, delete/skip fixtures, or alter any verify script's assertions to make it pass.
- No hand-edited ledger numbers in parity.md — wording fixes only; numbers come from real runs.
- No tasks created with wait_human_start or wait_human_merge true; no scratch files anywhere (unavoidable temp files go under docs/reports/ and are deleted before finish).
