---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Wire the 9 unwired verify scripts into the gate; fix parity.md's "full verify" claim (QA-05)

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Final-generation (quality-audit-5, N=5 of 5) fix task for a high-severity verified open finding. Re-verified at generation-5 HEAD (39556aa): package.json:22 verify:all still omits all 9 scripts (verify-colors, verify-custom-properties, verify-legacy-removal, verify-measure-perf, verify-measure-persist, verify-paint-fallback, verify-paint-perf, verify-property-coverage, verify-rtl); scripts/verify-rtl.mjs + scripts/verify-paint-fallback.mjs have ZERO npm entries (grep of package.json empty); the other 7 have named npm entries (verify:property-coverage, verify:legacy-removal, verify:colors, verify:custom-properties, verify:measure-perf, verify:measure-persist, verify:paint-perf) but are out of verify:all; docs/ledgers/parity.md:24 overclaim ("full npm run verify") persists. This task supersedes the gen-0 task `verify-gate-coverage` (created at generation 0, never dispatched across 5 generations — treat its scope on re-verified merit). Prior attempt-log entries: none for QA-05 (0 task attempts; only verification re-checks at gens 1-5). Touched areas since the gen-4 anchor (9523c2c): qa13-drift-prone-edges landing — src/canvas/index.ts, src/cascade/index.ts, src/cascade/media.ts, src/harness/tolerances.ts, timing ledgers icu/layers/sweep/text-measure refreshed; quality-audit-4 audit branch touched docs only. Your touch surface: package.json, docs/ledgers/parity.md, docs/ledgers/quality-audit.md, plus scripts/verify-*.mjs headers read-only to enumerate env requirements. NOTE: this and qa03-charter-deferred-enforcement both touch docs/ledgers/parity.md but at disjoint locations (wording at :24 vs census/Latest Run later in the file); re-verify against HEAD before editing either.

## Requirements

- [ ] Re-verify QA-05 against HEAD first: enumerate scripts/verify-*.mjs and cross-check each against package.json (verify:all + named scripts). Record the enumerated diff in the commit message. If the finding is disproven (everything already wired), record the disproof in docs/ledgers/quality-audit.md (attempt log) and finish — no manufactured changes, no silent drop.
- [ ] Wire every environment-independent verify-*.mjs into verify:all. For each of the 9, first read its header/env requirements: if a script needs environment the gate cannot provide (e.g. verify-paint-fallback's documented daemon-driven mode), wire it into a new documented tier (e.g. verify:extra) with one README sentence — it must be reachable from package.json either way; never leave a verify script unwired.
- [ ] Add npm entries for verify:rtl and verify:paint-fallback if missing.
- [ ] Fix docs/ledgers/parity.md:24 (and any sibling wording) so the gate description matches reality: `verify` is the fast subset, `verify:all` is the full gate. Wording only — never hand-edit the ledger's numbers; numbers change only from real runs.
- [ ] Update docs/ledgers/quality-audit.md: QA-05 status + attempt-log row + touched areas. This is a chain fix task but NOT the audit: create no successor audit; create follow-up tasks (max 3 total, wait_human_start/merge false) only if you uncover an important new finding; register lesser ones in the ledger instead.
- [ ] Obey the loop protocol verbatim (docs/ledgers/quality-audit.md §Loop protocol): worktree-only, no .orchestration/ or tmp/ or /tmp, no orch CLI, no git push, no scratch files, commit everything, leave the tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0. npm run verify:all exits 0 — now including the newly wired scripts. A shell enumeration proves closure: every scripts/verify-*.mjs filename appears in package.json (directly or via the documented tier) and the two previously unwired scripts have npm entries.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no orch CLI from a shell; no git push (permission prompts cannot be answered — the operator is unavailable).
- No weakening of gates: do not edit tolerances, delete/skip fixtures, or alter any verify script's assertions to make it pass (loop protocol §7).
- No hand-edited ledger numbers in parity.md — wording fixes only; numbers come from real runs.
- No tasks created with wait_human_start or wait_human_merge true; no scratch files (unavoidable temp files go under docs/reports/ and are deleted before finish).
- This task is NOT the audit chain and must NOT create a successor audit or any second audit chain.
