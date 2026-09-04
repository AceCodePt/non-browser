---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Break the block-inline⇄tables import cycle; hoist table UA defaults into cascade/ua.ts

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Finding QA-01 (high, arch) of docs/ledgers/quality-audit.md, re-verified open + drifted-further by generation 1 (2026-09-04, post tables-border-collapse). Three entangled defects: (a) a runtime import cycle — block-inline.ts:31 imports layoutTableContent/tableBorderBoxWidth/tablePreferredWidth/setTableAvailableInlineSize from './tables.js' while tables.ts:49 imports layoutElementBox/expandContents/FloatManager/buildPieces/pushPaintOp + types from './block-inline.js'; (b) a side-channel module global — block-inline.ts:1596 calls setTableAvailableInlineSize(available) as a side effect of width resolution, writing lastAvailableInlineSize (tables.ts:1478) that tables re-reads at tables.ts:1556 (hoisted content width) and 1630; (c) split-brain UA defaults — tableDefaultsFor (block-inline.ts:110-130) holds the table/tr/td/th/caption UA declarations in the layout monolith while every other UA decl lives in cascade/ua.ts (which has none of the table tags).

## Requirements

- [ ] Re-verify QA-01 against HEAD first (the tree moved: tables-border-collapse landed). Grep the current block-inline⇄tables import edges, the setTableAvailableInlineSize/lastAvailableInlineSize side channel, and the tableDefaultsFor UA decls; record file:line evidence in the commit message. If disproven, record the disproof in docs/ledgers/quality-audit.md's attempt log and commit with no code change — no manufactured work, no silent drop.
- [ ] Eliminate the setTableAvailableInlineSize side channel: thread the available inline size explicitly (a parameter, or a field on layoutTableContent's TableLayoutInput / tableBorderBoxWidth's return) so no module-level mutable global is written or read. Delete lastAvailableInlineSize and the setTableAvailableInlineSize export, and grep-sweep src/ for any remaining readers/writers.
- [ ] Consolidate the table UA defaults: move tableDefaultsFor (block-inline.ts:110-130: table border-collapse:separate + border-spacing:2px, tr/thead/tbody/tfoot vertical-align:middle, td/th 1px padding + vertical-align:middle, th font-weight:700 + text-align:center, caption text-align:center) into cascade/ua.ts as table-tag UA rules, and delete the monolith copy.
- [ ] Break the import cycle in both directions (block-inline.ts:31 and tables.ts:49) if it fits the context window — e.g. extract the primitives tables needs (layoutElementBox/expandContents/FloatManager/buildPieces/pushPaintOp) into a shared third layout module. If that extraction is too large for one window, complete items 2 and 3 and register the residual cycle-break in the ledger for the next generation — never leave the side channel or the UA split-brain half-done.
- [ ] Never weaken established quality to pass a gate: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers (ledgers change only from real script runs), no disabled verify scripts.
- [ ] Update docs/ledgers/quality-audit.md: QA-01 status (fixed or registered-residual) + an attempt-log row with evidence. This is a chain fix task, NOT an audit: create no successor audit and no second audit chain. You may create at most 3 tasks total (all wait_human_start: false / wait_human_merge: false); important out-of-scope discoveries become tasks, lesser ones are registered in the ledger.
- [ ] Obey the loop protocol verbatim (embedded below) exactly: worktree-only, never touch .orchestration/, tmp/, /tmp, or anything outside the worktree, never invoke the orch CLI from a shell, never git push, no scratch files (unavoidable temp files under docs/reports/ only, deleted before finishing), commit everything, leave the tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0. Touched-area gates exit 0: npm run verify:tables, npm run verify:tables-collapse, npm run verify:ua-styles, npm run verify:text-level-ua, and npm run verify:all. Shell closure proofs: `grep -rn "setTableAvailableInlineSize\|lastAvailableInlineSize" src/` is empty; `grep -n "tableDefaultsFor" src/layout/block-inline.ts` is empty; the table-tag UA defaults are grep-able in src/cascade/ua.ts; and if the cycle was broken, `grep -n "from './tables.js'\|from './block-inline.js'" src/layout/block-inline.ts src/layout/tables.ts` shows no mutual import edge.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no `orch` CLI from a shell; no git push; no scratch files (unavoidable temp files under docs/reports/ only, deleted before finish) — permission prompts cannot be answered, the operator is unavailable.
- No more than 3 created tasks total; no successor audit and no second audit chain; no created task with wait_human_start or wait_human_merge true.
- No gate weakening: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers, no disabled verify scripts.
- No silent drops: if the finding is disproven or only partially fixable, it is recorded in the ledger with evidence — never left to vanish.
