---
wait_human_start: false
wait_human_merge: false
dependencies: [orch-verify-hook]
---

# Task: Probe and close the masked-text screenshot gap

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Improvement-plan §1 (docs/improvement-plan.md). The charter's mission is a "static pixel buffer matching a target browser" and §10 claims a Skia-vs-Skia raster band, but verify-four-layer.mjs (MASK_PAD=2 at :37-38, mask build at :226) excludes every text fragment from the screenshot diff, so zero glyph pixels are compared. 30 of 108 fixtures carry non-empty textElements (spine 5, paint-text 9, floats 7, firefox-track 4, flexbox 2, grid 2, positioning 1); masked share on text-bearing spine fixtures is 12.5-35%. Honest summary: all non-text pixels are compared, none of the text pixels are. Both sides rasterize via Skia (Chrome's own vs @napi-rs/canvas), so the probe decides whether the diff is pure AA fringe (shrink mask) or structural (tiered tolerance). Fix the mask decision before claiming pixel parity.

## Requirements

- [ ] A probe (fits the probe-oracle.mjs precedent) renders the spine text fixtures' screenshot layer unmasked and reports the per-text-region ΔE distribution, distinguishing pure AA-fringe divergence from structural (subpixel offset / hinting) divergence
- [ ] The probe output is captured in a ledger (docs/ledgers/) and names the decision: shrink/drop the text mask to the AA fringe if within tolerance, else replace exclusion with a tiered text-region tolerance
- [ ] The four-layer screenshot diff no longer excludes all text by default: either text pixels are compared under the charter §10 band, or under a documented tiered tolerance, or the mask is shrunk to a justified region - every remaining masked pixel is justified by the probe
- [ ] The report surfaces a per-fixture text-parity metric (e.g. textRegionPixelsCompared / text-region ΔE) so text coverage is visible rather than silently excluded
- [ ] The charter §10 claim is reconciled with the chosen mechanism (charter amended or tolerances.md ledger entry) so the documented claim matches what is measured

## Verification

npm run build passes. The probe script runs against the spine corpus and its output (ledger entry naming the decision) is committed. npm run verify:four-layer exits 0 with the chosen mechanism active, and the report shows a per-fixture text-parity metric and the actual text-pixel mask share instead of masking everything text-shaped. The charter or tolerances.md ledger reflects the decision.

## Prohibited Patterns

- Do not keep blanket text masking without a probe-justified rationale
- Do not weaken the charter's screenshot tolerance band to make diffs pass
- Do not edit corpus fixtures to force green screenshot results
- Do not claim text raster parity unless the report actually compares text pixels
