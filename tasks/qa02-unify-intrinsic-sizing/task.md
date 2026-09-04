---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: One shared intrinsic-sizing module in layout; delete the dead minimum field

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Finding QA-02 (high, code) of docs/ledgers/quality-audit.md, re-verified open + drifted-further by generation 1 (2026-09-04, post tables-border-collapse). The intrinsic-sizing helpers are quadruplicated across flexbox/grid/tables/block-inline with five real drift axes: (1) grid skips display:table children in inline-detection (grid.ts:69,85) where flex does not (flexbox.ts:113,129); (2) flex skips position:absolute/fixed (flexbox.ts:164,180) where grid does not (grid.ts:106-113); (3) flex honors box-sizing:border-box via borderBox() (flexbox.ts:197-198) where grid reads style.width.px raw (grid.ts:123); (4) tables measures collapsed spaces with a single cell-style spaceW (tables.ts:741) vs block-inline's per-piece run style (block-inline.ts:2904,2936,2943); (5) tables caps max at break pieces (tables.ts:743-748) vs block-inline skipping breaks. Plus the dead `minimum` return field on grid's inlineContributions (grid.ts:121,128,133) with zero readers.

## Requirements

- [ ] Re-verify QA-02 against HEAD first: locate the four intrinsic-sizing implementations and the dead minimum field, confirm the five drift axes, and record file:line evidence in the commit message. If disproven, record the disproof in docs/ledgers/quality-audit.md's attempt log and commit with no code change — no manufactured work, no silent drop.
- [ ] Expand-contract: add a shared module (e.g. src/layout/intrinsic.ts) exposing the content-intrinsic helpers parameterized by policy — display-skip set (table?/absolute?/fixed?/float?), space measurement (single style vs per-piece run style), and break handling (cap max at break pieces vs skip breaks) — then migrate the four callers (flexbox.ts, grid.ts, tables.ts, block-inline.ts) in batches, npm run verify:all green after each batch, then delete the four local copies.
- [ ] Preserve each caller's current behavior exactly via the policy parameters. If a drift turns out to be an oracle-verifiable bug, fix it WITH a ledger note and evidence — never fix a drift silently and never regress an oracle-parity gate.
- [ ] Delete the dead `minimum` field from grid's inlineContributions (grid.ts:121,128,133) and every remaining producer/reader of it.
- [ ] Never weaken established quality to pass a gate: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers (ledgers change only from real script runs), no disabled verify scripts.
- [ ] Update docs/ledgers/quality-audit.md: QA-02 status + an attempt-log row with evidence. This is a chain fix task, NOT an audit: create no successor audit and no second audit chain. You may create at most 3 tasks total (all wait_human_start: false / wait_human_merge: false); important out-of-scope discoveries become tasks, lesser ones are registered in the ledger.
- [ ] Obey the loop protocol verbatim (embedded below) exactly: worktree-only, never touch .orchestration/, tmp/, /tmp, or anything outside the worktree, never invoke the orch CLI from a shell, never git push, no scratch files (unavoidable temp files under docs/reports/ only, deleted before finishing), commit everything, leave the tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0. npm run verify:all exits 0 (it includes the named touched-area gates verify:layout-flexbox, verify:layout-grid, verify:tables, verify:tables-collapse, verify:text-measure, verify:layout-inline-block). Shell closure proof: after deleting the four local copies, `grep -rn "function contentInlineSizes" src/layout/` has at most one hit (the shared module), or all four callers import from the shared module; `grep -rn "\.minimum" src/layout/grid.ts` shows no producer or reader of the dead field.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no `orch` CLI from a shell; no git push; no scratch files (unavoidable temp files under docs/reports/ only, deleted before finish) — permission prompts cannot be answered, the operator is unavailable.
- No more than 3 created tasks total; no successor audit and no second audit chain; no created task with wait_human_start or wait_human_merge true.
- No gate weakening: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers, no disabled verify scripts.
- No silent drops: if the finding is disproven or only partially fixable, it is recorded in the ledger with evidence — never left to vanish.
