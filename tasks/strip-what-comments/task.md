---
wait_human_start: false
wait_human_merge: false
dependencies: [font-registration-gaps, flexbox-baseline-authority, flexbox-wrap-reverse]
---

# Task: Remove what-comments; keep why-comments; document the comment policy

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The tree carries heavy JSDoc/file-header/inline comments that restate what the code does (src/layout/block-inline.ts ~239 comment lines, css.ts ~123, grid.ts ~64). The repo's comment policy should be: comments explain why, never what. This task strips the what-comments across all source (src/, scripts/, probes/), leaves code byte-identical, keeps why-comments (decisions, spec cross-references, invariants, workarounds), and documents the policy in AGENTS.md so it stays enforced. Scheduled after the three parity slices because it rewrites the same files (flexbox.ts, fontmetrics.ts, chrome.ts) and would conflict if concurrent.

## Requirements

- [ ] Remove every comment (incl. JSDoc and module/file headers) that only restates what the code does or names entities, across src/, scripts/ and probes/ — zero code changes: the diff is deletions-only.
- [ ] Keep why-comments: rationale, design decisions, spec cross-references (e.g. "CSS 2.1 §8", "matching Chrome's X"), workarounds, and non-obvious invariants (e.g. "this module must stay float-agnostic").
- [ ] Document the policy in AGENTS.md at the repo root: comments explain why, not what; no JSDoc that merely restates a signature.
- [ ] Runtime behavior unchanged: exports, strings, and control flow identical — tsc strict green, and git diff vs the base shows only deletions.

## Verification

npm run build passes (tsc strict). On the task branch, `git diff --stat` vs the base shows only line deletions with no modified code lines. Spot-check confirms every remaining comment explains why or references a spec/decision. AGENTS.md documents the policy.

## Prohibited Patterns

- Do not delete why-comments/rationale or spec cross-references.
- Do not change code, formatting, or run Prettier over the tree — that would churn the diff and break the deletions-only property.
- Do not remove comments in corpus/ fixtures or docs/ — those are data and ledgers, not code comments.
