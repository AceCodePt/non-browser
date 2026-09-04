---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Fix the mechanical drift-prone hygiene edges — barrel completion, dead mode validation, media print-claim (QA-13)

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Finding QA-13 (low-med, hygiene) of docs/ledgers/quality-audit.md, re-verified open by generation 4 (2026-09-04, post the qa09-unify-cascade-parse-helpers + qa12-unify-measure-seam landings, HEAD 9523c2c). QA-13 is a grab-bag of drift-prone edges; this task takes the mechanical one-context-window slice and registers the rest as residual: (a) barrel gaps — src/canvas/index.ts omits `export * from './measure-cache.js'` (the module exists with 6 exports: cachedMetrics/cachedFamilyHas/cachedResolvedRuns/invalidateMeasureCache/getMeasureCacheMisses/resetMeasureCacheMisses) and src/cascade/index.ts omits `export * from './supports.js'` (exists with parseSupportsCondition/evaluateSupportsDeclaration/evaluateSupportsCondition); (b) dead mode validation at src/harness/tolerances.ts:81 `mode: computedStyleRaw.mode === 'exact' ? 'exact' : 'exact'` — a ternary whose both branches are identical; (c) media type-claim mismatch — src/cascade/media.ts:9-10 header claims `print` is a supported media type but the evaluator at media.ts:486 returns only `all`/`screen`. The config⇄canvas module cycle (browser-config.ts:13 imports invalidateMeasureCache), the hand-mirrored fallback-table ledgers, and the ~17 zero-reader cascade exports + unread pretext wrapper types + SkiaCanvasFactory are explicitly OUT of scope (larger/design-y) — register as residual. Read the loop protocol in docs/ledgers/quality-audit.md §"Loop protocol" before starting — it binds you.

## Requirements

- [ ] Re-verify QA-13's three sub-items against HEAD first (the tree moves between generations): grep the canvas/cascade barrels for measure-cache/supports, read src/harness/tolerances.ts:81, and check media.ts:9-10 header vs the :486 type evaluator. Record file:line evidence in the commit message. If any sub-item is disproven (already fixed), record that in the attempt log and skip it honestly — no manufactured work, no silent drop.
- [ ] Complete the barrels with no name collisions (verified at gen-4 HEAD: none exist): add `export * from './measure-cache.js'` to src/canvas/index.ts and `export * from './supports.js'` to src/cascade/index.ts. Build must stay green.
- [ ] Fix the dead ternary at src/harness/tolerances.ts:81: `mode: computedStyleRaw.mode === 'exact' ? 'exact' : 'exact'` collapses to a plain `'exact'` assignment (the ComputedStyleTolerance mode type is a single literal); preserve behavior exactly.
- [ ] Reconcile the media type claim at src/cascade/media.ts:9-10 with the evaluator at :486: either make the evaluator accept `print` per its documented grammar (if print is genuinely intended to match) or fix the header comment to state what the evaluator actually does (all/screen only). Do not change matching behavior that the media-queries/media-modern corpora pin — this is a claim/comment correction unless you can show the evaluator is wrong.
- [ ] Register the out-of-scope residuals (config⇄canvas cycle; fallback-table ledger mirroring; the zero-reader export sweep incl. SkiaCanvasFactory) in the QA-13 registry row with evidence.
- [ ] Never weaken established quality to pass a gate: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers, no disabled verify scripts.
- [ ] Update docs/ledgers/quality-audit.md: QA-13 status + an attempt-log row with evidence. This is a chain fix task, NOT an audit: create no successor audit and no second audit chain. You may create at most 3 tasks total (all wait_human_start: false / wait_human_merge: false); important out-of-scope discoveries become tasks, lesser ones are registered in the ledger.
- [ ] Obey the loop protocol verbatim (docs/ledgers/quality-audit.md §Loop protocol): worktree-only, no .orchestration/ or tmp/ or /tmp, no orch CLI from a shell, no git push, no scratch files, commit everything, tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0. npm run verify:all exits 0 (it includes verify:custom-properties, verify:supports, verify:media-queries, verify:media-modern, verify:segmenter, verify:text-measure). Shell closure proof: `grep -n "measure-cache" src/canvas/index.ts` non-empty; `grep -n "supports" src/cascade/index.ts` non-empty; `grep -n "computedStyleRaw.mode === 'exact'" src/harness/tolerances.ts` empty (ternary gone); media.ts header and evaluator agree on the `print` type (both claim it matches, or the header states all/screen-only). If a sub-item was disproven at re-verify, its disproof is recorded in the ledger attempt log and its commit message — code unchanged for that sub-item.

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or anything outside the worktree; no orch CLI from a shell; no git push; no scratch files (temp files under docs/reports/ only, deleted before finish) — permission prompts cannot be answered, the operator is unavailable.
- No more than 3 created tasks total; no successor audit and no second audit chain; no created task with wait_human_start or wait_human_merge true.
- No gate weakening: no tolerance edits, no fixture deletion/skipping, no hand-edited ledger numbers, no disabled verify scripts.
- No behavior change beyond the dead-ternary collapse and the claim/comment reconciliation — the mode stays 'exact' and media matching stays exactly as the corpora pin it.
- No silent drops: any sub-item that turns out to be disproven or only partially fixable is recorded in the ledger with evidence — never left to vanish.
