---
wait_human_start: true
wait_human_merge: false
dependencies: [opacity-subtree-compositing]
---

# Task: Task: Rect clipping for square overflow:hidden and overflow:clip/auto parsing

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

block-inline.ts:729 only pushes a paint clip when overflow:hidden AND hasNonZeroRadius(borderRadius), so a square overflow:hidden box does not clip its subtree; overflow is also a binary visible/hidden (css.ts:1407) with no auto/scroll/clip. Rounded overflow clips work; rect clips and scroll semantics don't. Fix: a plain-rect clip path in the clip stack for square overflow:hidden, and parse overflow:clip/auto per css-overflow-3 with Chrome-matching clipping. Depends on opacity-subtree-compositing to serialize the shared block-inline.ts/paint.ts edits.

## Requirements

- [ ] overflow:hidden without border-radius clips its subtree to the border box via a rect clip entry in the clip stack; new corpus fixtures (squares with overflowing children, incl. negative-margin children) pass layer 4.
- [ ] overflow:clip parses and clips (no scroll container); overflow:auto parses — scrollbar layout may be documented/deferred but must not mis-layout the box.
- [ ] The clip stack carries both rect and rounded entries with the shared mutable-box behavior preserved (the block-inline.ts clipEntry pattern).
- [ ] check-charter green with overflow rows.

## Verification

npm run build passes. A verify:overflow script (wired into session-idle's *overflow* case) or verify:paint-text exits 0 on the clip corpus. grep shows the clip decision is no longer gated on hasNonZeroRadius alone.

## Prohibited Patterns

- Do not weaken layer-4 tolerances.
- Do not regress the rounded overflow:hidden clip.
- Do not mask the divergence — the clip must actually clip.
