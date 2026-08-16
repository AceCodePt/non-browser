---
wait_human_start: true
wait_human_merge: false
dependencies: [archive-audit-empty]
---

# Task: Task: Reconcile the charter coverage matrix with what the engine actually implements

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

check-charter.mjs enforces the charter §11 coverage matrix only over rows that exist. Features whose tasks were archived with no code — opacity-compositing, box-shadow-paint, tables-layout — and never-landed work (calc) have no row at all, so check-charter cannot catch their absence: omission is silent, the same disease that let the empty archives pass. After the archive audit classifies what actually shipped, reconcile the matrix to src reality so a feature can no longer vanish without a record.

## Requirements

- [ ] Diff the properties the engine resolves (src/layout/css.ts computed-style) and paints (src/layout/paint.ts) against the §11 rows; list implemented-but-unclaimed and claimed-but-absent properties.
- [ ] For each gap, either add a matrix row backed by a corpus fixture exercising the token, or record an explicit 'not in v1 / deferred' entry (charter amendment + ledger note) — no silent absence.
- [ ] check-charter.mjs stays the enforcement seam; verify it catches matrix↔corpus↔source inconsistency after the change.
- [ ] The reconcile diff agrees with the archive-audit.md classification.

## Verification

node scripts/check-charter.mjs exits 0. The task's reconcile diff shows zero silent gaps — every implemented property is either matrix-claimed with a corpus token or explicitly deferred. The classification matches docs/ledgers/archive-audit.md.

## Prohibited Patterns

- Do not weaken check-charter.mjs enforcement.
- Do not claim a property in the matrix without a corpus fixture exercising its token.
- Do not silently drop a feature — absence must be an explicit deferred/charter-amendment entry.
