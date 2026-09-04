---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Machine-enforce the charter's Deferred / Not-in-v1 section; regenerate the contradictory coverage-matrix and parity ledgers (QA-03, QA-04, QA-08)

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Final-generation (quality-audit-5, N=5 of 5) fix task for the highest-severity verified open findings. Re-verified at generation-5 HEAD (39556aa): QA-03 — scripts/check-charter.mjs:176-227 parses only the §11 coverage-matrix table (matrixMarker at :176, rows at :190-227, nothing past it); docs/charter.md:223 "Deferred / Not in v1 (no silent absence)" — the documented no-silent-absence contract — has zero machine enforcement. QA-04 — docs/ledgers/coverage-matrix.md:76-80 deferred table still lists opacity/shadow/calc/custom-props as EMPTY/never-landed while charter §11:140-143 (calc/min/max/clamp), :174-175 (box-shadow/text-shadow), :179 (opacity), :196-200 (custom properties) mark them implemented=yes with corpus tokens; coverage-matrix.md:112 still says "all 53 rows" vs 106 §11 data rows counted at gen-5 HEAD. QA-08 — docs/ledgers/parity.md:92-104 census lists media-queries/container-gap which now declares expected.computedStyle "pass" (flipped, no typed gap) and omits corpus/legacy-removal/legacy-elements' 3 typed gaps (fail computedStyle/rect/screenshot with reason+sunset); parity.md's "Current count: 2" vs check-charter's "4 typed gap declaration(s)" (re-run at gen-5 HEAD); Latest Run rows still 2026-08-14/17. This task supersedes the gen-0 task `charter-deferred-enforcement` (created at generation 0, never dispatched across 5 generations — treat its scope on re-verified merit). Prior attempt-log entries: none for QA-03/04/08 (0 task attempts each; only verification re-checks at gens 1-5). Touched areas since the gen-4 anchor (9523c2c): qa13-drift-prone-edges landing — src/canvas/index.ts (+measure-cache barrel), src/cascade/index.ts (+supports barrel), src/cascade/media.ts (print-claim correction), src/harness/tolerances.ts (dead ternary), timing ledgers icu/layers/sweep/text-measure refreshed; quality-audit-4 audit branch touched docs only. Your touch surface: docs/charter.md, scripts/check-charter.mjs, docs/ledgers/coverage-matrix.md, docs/ledgers/parity.md, docs/ledgers/quality-audit.md.

## Requirements

- [ ] Re-verify QA-03/QA-04/QA-08 against HEAD first (the tree moves between generations); record the evidence in the commit message. Disproof of any part → record it in docs/ledgers/quality-audit.md attempt log and skip that part honestly (no silent drops).
- [ ] Restructure the charter §11 'Deferred / Not in v1' prose (docs/charter.md:223+) into a table the checker can parse (columns: Absent surface | Status | Evidence), preserving every existing claim's content. Statuses: 'absent' (the token must NOT appear in src/**/*.ts) and 'declared-divergence' (the token must appear in src/ AND the row must cite its ledger doc).
- [ ] Extend scripts/check-charter.mjs to parse that table and assert token presence/absence per status. Prove the enforcement with a deliberate contradiction probe: temporarily flip one row so its status contradicts the source tree, run check-charter (must FAIL), revert, and describe the probe in the commit message.
- [ ] Regenerate docs/ledgers/coverage-matrix.md's deferred table from the restructured charter so it stops contradicting §11 (opacity/shadow/calc/custom-props are implemented), and correct the 'all 53 rows' claim to the real §11 data-row count. No hand-written numbers.
- [ ] Refresh docs/ledgers/parity.md's gap census from the actual corpus gap declarations (check-charter reports '4 typed gap declaration(s)' at HEAD) and its Latest Run section from a real run of the touched corpora, stating run date + command honestly. No hand-written numbers.
- [ ] Update docs/ledgers/quality-audit.md (QA-03/QA-04/QA-08 statuses + attempt log + touched areas). This is a chain fix task, not the audit: create no successor audit; follow-up tasks (max 3 total, wait_human_start/merge false) only for important new findings.
- [ ] Obey the loop protocol verbatim (docs/ledgers/quality-audit.md §Loop protocol): worktree-only, no .orchestration/ or tmp/ or /tmp, no orch CLI, no git push, no scratch files, commit everything, tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0 with the Deferred section enforced; the deliberate-contradiction probe (flip a row → check fails → revert) is documented in the commit message. npm run verify:colors, verify:calc, verify:shadow, verify:opacity, verify:custom-properties all exit 0, backing the regenerated ledger claims. docs/ledgers/coverage-matrix.md and parity.md contain no claim contradicted by the charter or the corpus.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no orch CLI from a shell; no git push (permission prompts cannot be answered — the operator is unavailable).
- No charter content changes beyond the structure-preserving Deferred-table rewrite; no tolerance edits; no fixture deletion/skipping; no disabled verify scripts.
- No hand-edited ledger numbers — census and Latest Run regenerate from real script runs only.
- No tasks created with wait_human_start or wait_human_merge true; no scratch files (unavoidable temp files go under docs/reports/ and are deleted before finish).
- Never weaken established quality to pass a gate (loop protocol §7): the new enforcement must fail on real contradictions, not be tuned to pass.
- This task is NOT the audit chain and must NOT create a successor audit or any second audit chain.
