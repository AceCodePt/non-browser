---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine, text-measure-corpus, cascade-core, layout-block-inline, paint-shapes]
---

# Task: Corpus-Expansion

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Integration: the broad real-world corpus (both generic HTML/CSS and @ace-code/shast renderComponent output — same strings), CI wiring so every task's verify script runs on every change, and an aggregate parity report measuring where the project sits against the 95-99% pixel-parity target. Depends on the fan-out completing so the corpus can exercise the full pipeline.

## Requirements

- [ ] Broad corpus: at least 30 fixtures spanning parse/cascade/layout/paint coverage, authored both as generic HTML+CSS and as @ace-code/shast components rendered through the same pipeline
- [ ] Real-world-shaped fixtures: typical marketing/blog/component-style pages (text, flex, grid where landed, floats, positioning) without images or interactive features
- [ ] Aggregate parity report: npm run verify:all renders the whole corpus and reports overall four-layer pass rates, including the pixel-parity percentage vs the 95-99% target
- [ ] CI wiring (GitHub Actions or the project's chosen CI) that runs every npm run verify:* script on push and blocks on failures
- [ ] Replaced-box fixtures verify <canvas> and <img> render as empty boxes at layout size in both generic and shast-fed paths
- [ ] docs/ledgers/parity.md records the aggregate results and any corpus additions/removals with rationale

## Verification

`npm run verify:all` exits 0 (CI runs it on push): whole corpus passes all four layers within tolerances, aggregate pixel-parity percentage reported in docs/ledgers/parity.md.

## Prohibited Patterns

- Do not relax charter tolerances to force the corpus green — report the real aggregate number
- Do not add image decoding; image fixtures must be replaced-box expectations
- Do not introduce Playwright outside the test-oracle role
