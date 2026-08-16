---
wait_human_start: true
wait_human_merge: false
dependencies: []
---

# Task: Task: Port the tiered text-region screenshot tolerance to the per-corpus verifiers

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

parity.md Honest Reading #1: text-mask-parity added the tiered text-region screenshot tolerance (tolerances.json layers.screenshot.text) only to verify-four-layer.mjs; the per-corpus verifiers (verify:paint-text, verify:layout-{floats,grid,flexbox,positioning}, verify:firefox) still blanket-mask text regions, so their "0 exceeding" screenshots hide the structural text-rasterizer divergence (60–74% of glyph-interior pixels exceed ΔE2). Port the tier so every fixture reports its text pixels compared (mean/worst ΔE, text-pixel mask share) instead of silently excluding them.

## Requirements

- [ ] Port the tiered text-region logic from verify-four-layer.mjs into verify:paint-text, verify:layout-{floats,grid,flexbox,positioning} and verify:firefox; each fixture reports text-region pixels compared, mean/worst ΔE, and text-pixel mask share.
- [ ] Remove the blanket text masking from those scripts; only declared maskRects/maskElements (e.g. the <img> broken-image icon) stay masked.
- [ ] The text-tier config lives in tolerances.json only — one authority.
- [ ] Reports under docs/reports/ reflect the tiered numbers.

## Verification

npm run verify:paint-text, verify:layout-{floats,grid,flexbox,positioning} and verify:firefox all exit 0 with text-tier numbers in their report output. grep confirms no remaining blanket text mask in those scripts.

## Prohibited Patterns

- Do not change tolerance values in tolerances.json.
- Do not weaken the non-text screenshot gate (ΔE ≤ 2, ≤ 1% exceeding).
- Do not reintroduce implicit text masking.
