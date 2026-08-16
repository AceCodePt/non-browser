---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Single baseline authority via fontmetrics; remove hard-coded flexbox baseline fractions

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Flexbox baselines are hard-coded (src/layout/flexbox.ts:52 FONT_ASCENT_FRAC = 1069/1000, plus fontmetrics.ts:32 a Noto-specific ascent constant 1069), while block-inline and paint resolve baselines through fontmetrics — three separate baseline formulas. The six nowrap + align-items:baseline sweep fixtures diverge 30px on rect (corpus/sweep-flexbox/*-baseline). Because flexbox ignores the active browser config, under the Firefox config its baselines are wrong by construction and the Firefox seam's 0.0000px report is tautological (engine vs its own constants) — documented in docs/ledgers/parity.md Honest Reading item 5. Fix: one baseline authority derived from the registered face's metrics, shared by flexbox, block-inline and paint, resolving through the active browser config.

## Requirements

- [ ] Establish one baseline authority in src/layout/fontmetrics.ts (ascent/descent/line-height from the active face's metrics, not a Noto constant) and make flexbox.ts, block-inline.ts and paint resolve baselines through it.
- [ ] Delete FONT_ASCENT_FRAC (flexbox.ts:52) and the hard-coded ascent constant (fontmetrics.ts:32); no module defines its own ascent/descent fractions.
- [ ] Flexbox align-items:baseline and line-baseline computation resolve through the authority AND the active browser-config, so the Firefox seam stops comparing the engine against its own constants.
- [ ] Flip the six nowrap-*-baseline sweep fixtures to pass: remove their rect/screenshot typed gaps, rect max Δ ≤ 0.5px.
- [ ] Update docs/ledgers/sweep.md and parity.md gap counts (36 → 30) and record the baseline dedup in parity.md Honest Reading item 5.

## Verification

npm run build passes. npm run verify:sweep green with the baseline sweep fixtures passing (gap count 36 → 30). npm run verify:layout-flexbox green. npm run verify:firefox green and no longer reports the tautological 0.0000 baseline seam. Grep confirms a single definition of ascent/descent baseline math in src/.

## Prohibited Patterns

- Do not reintroduce per-module baseline constants or ascent/descent fractions.
- Do not weaken the rect tolerance (≤ 0.5px) or screenshot tier to pass.
- Do not touch the wrap-reverse sweep fixtures — flexbox-wrap-reverse owns those.
- Do not change Chrome-config baseline behavior: the chrome path must stay byte-identical on rects.
