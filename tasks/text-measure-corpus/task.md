---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Text-Measure-Corpus

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Layer-1 parity: canvas measureText. Pretext's ground truth is canvas.measureText; parity of the whole renderer rides on our skia measureText matching Chrome's canvas measureText for the same fonts. Owning module text/measure-corpus/, corpus/measure-corpus/.

## Requirements

- [ ] Corpus of strings x fonts (Latin, CJK, RTL/Arabic/Hebrew, emoji, combining marks, tab runs, letter-spaced) covering the cases Pretext advertises
- [ ] Comparison script (npm run verify:text-measure) measuring every corpus string with the Canvas interface's measureText AND a real Chrome canvas measureText via Playwright, with the same registered font files
- [ ] Sub-pixel tolerance (per charter, default <0.01px mean, no single string >0.5px) implemented in the harness layer-1 runner
- [ ] docs/ledgers/text-measure.md records per-string widths, deltas, pass/fail, and any font that fails
- [ ] Every corpus string with a registered font passes; failures are only permitted for documented known gaps listed in the ledger

## Verification

`npm run verify:text-measure` exits 0: all corpus strings within tolerance, ledger docs/ledgers/text-measure.md updated with the latest run summary (counts, worst delta, pass rate).

## Prohibited Patterns

- Do not hand-roll measurement; compare the Canvas interface's measureText, do not fork it
- Do not touch other tasks' corpus dirs or modules
- Do not change Pretext's own segmentation/breaking logic — that is text-breaker-parity's scope
