---
wait_human_start: false
wait_human_merge: false
dependencies: [verify-gate-coverage]
---

# Task: Machine-enforce the charter's Deferred/Not-in-v1 section; regenerate the contradictory coverage-matrix and parity ledgers

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Findings QA-03, QA-04, QA-08 of docs/ledgers/quality-audit.md. QA-03: scripts/check-charter.mjs parses only the §11 matrix table (lines 176-227); the "Deferred / Not in v1" section (docs/charter.md:221-258) — the documented "no silent absence" contract — has zero machine enforcement. QA-04: docs/ledgers/coverage-matrix.md contradicts charter §11 — its deferred table claims box-shadow, opacity, calc/min/max/clamp, custom-properties/var() absent/EMPTY while §11 marks them implemented with corpus coverage that exists and verifies; it also says "all 53 rows" while the matrix has 105. QA-08: docs/ledgers/parity.md's gap census says 2 declarations and lists media-queries/container-gap, but the corpus now has 4 typed gap declarations across 3 fixtures (container-gap flipped to pass; legacy-removal/legacy-elements declares 3 and is omitted entirely), and its Latest Run predates the five 2026-09-03 landings. Read the loop protocol in docs/ledgers/quality-audit.md §"Loop protocol" before starting — it binds you.

## Requirements

- [ ] Re-verify QA-03/QA-04/QA-08 against HEAD first (the tree moves); record evidence in the commit message. Disproof of any part → record in docs/ledgers/quality-audit.md attempt log and skip that part honestly.
- [ ] Restructure charter §11 'Deferred / Not in v1' into a table the checker can parse (columns: Absent surface | Status | Evidence), preserving every existing claim's content. Statuses: 'absent' (token must NOT appear in src/**/*.ts) and 'declared-divergence' (token must appear in src/ AND the row must cite its ledger doc).
- [ ] Extend scripts/check-charter.mjs to parse that table and assert token presence/absence per status. Prove the enforcement with a deliberate contradiction probe: temporarily flip one row so its status contradicts the source tree, run check-charter (must FAIL), revert, and describe the probe in the commit message.
- [ ] Regenerate docs/ledgers/coverage-matrix.md's deferred table from the restructured charter so it stops contradicting §11, and correct the row count to the real matrix size.
- [ ] Refresh parity.md's gap census from the actual corpus gap declarations (4 across 3 fixtures at analysis time) and its Latest Run section from a real run of the touched corpora, stating run date + command honestly. No hand-written numbers.
- [ ] Update docs/ledgers/quality-audit.md (QA-03/QA-04/QA-08 statuses + attempt log + touched areas). Chain task, not the audit: no successor audit; follow-up tasks (max 3, wait_human flags false) only for important new findings.
- [ ] Obey the loop protocol verbatim (docs/ledgers/quality-audit.md §Loop protocol): worktree-only, no .orchestration/ or tmp/ or /tmp, no orch CLI, no git push, no scratch files, commit everything, tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0 with the Deferred section enforced; the deliberate-contradiction probe (flip a row → check fails → revert) is documented in the commit message. npm run verify:colors, verify:calc, verify:shadow, verify:opacity, verify:custom-properties all exit 0, backing the regenerated ledger claims. docs/ledgers/coverage-matrix.md and parity.md contain no claim contradicted by the charter or the corpus.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or outside the worktree; no `orch` CLI from a shell; no git push (permission prompts cannot be answered — the operator is unavailable).
- No charter content changes beyond the structure-preserving table rewrite; no tolerance edits; no fixture deletion/skipping; no disabled verify scripts.
- No hand-edited ledger numbers — census and Latest Run regenerate from real script runs only.
- No tasks created with wait_human_start or wait_human_merge true; no scratch files (temp files under docs/reports/ only, deleted before finish).
