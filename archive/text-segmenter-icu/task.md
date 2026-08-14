---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Text-Segmenter-Icu

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Pretext segments text via Intl.Segmenter (grapheme granularity). Node's ICU and the browser's ICU can disagree across versions on ZWJ emoji, flags, combining marks, and Indic conjuncts — which shifts wrap points and therefore pixels. Pin the runtime and prove segmentation parity. Owning module text/segmenter-icu/, corpus/segmenter-icu/.

## Requirements

- [ ] Node runtime floor enforced at >=20 with full-icu; the verify script fails fast if Intl.Segmenter is missing or ICU data is small
- [ ] process.versions.icu recorded in docs/ledgers/icu.md alongside the Chrome (Playwright) ICU/Chromium version used by the oracle
- [ ] Segmentation corpus (ZWJ family emoji, regional flags, combining marks, Indic conjuncts, skin tones, grapheme clusters adjacent to spaces) segmented in Node and compared to the browser's Intl.Segmenter via Playwright
- [ ] Per-string segment-boundary comparison: identical segment count and boundaries required, documented divergences allowed only with a ledger entry
- [ ] A check that Pretext runs with the pinned runtime and produces identical layout() for the segmentation corpus in both environments

## Verification

`npm run verify:segmenter` exits 0: corpus segments identically in Node and the browser, ledger docs/ledgers/icu.md records both ICU versions and the result.

## Prohibited Patterns

- Do not implement custom grapheme breaking in this task — verify the pin first; a custom breaker is only justified by documented failures
- Do not bump the Node floor without recording it in the ledger
