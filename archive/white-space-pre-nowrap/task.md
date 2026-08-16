---
wait_human_start: false
wait_human_merge: false
dependencies: [pretext-engine-path]
---

# Task: White-Space-Pre-Nowrap

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. white-space is parsed into ComputedStyle (src/layout/css.ts:166, 915-919: normal/nowrap/pre) but the line breaker ignores it: layoutTextLines in src/layout/measure.ts:119 always collapses whitespace runs to a single space and splits on spaces. So white-space:pre (preserve spaces/newlines) and nowrap (no wrapping) do not behave like Chrome - pre-formatted text, code blocks, and single-line labels all diverge at layer 3 and the screenshot layer.

## Requirements

- [ ] white-space:pre preserves runs of spaces and newlines in line layout (newlines are forced breaks, spaces do not collapse), matching Chrome's line breaks and rects
- [ ] white-space:nowrap suppresses line wrapping (a line wider than the container overflows rather than wraps), matching Chrome's rects
- [ ] white-space:pre-wrap / pre-line handled as Chrome does (wrap on spaces but preserve sequences) or documented as a gap in the ledger with concrete examples if out of scope for this task
- [ ] The breaker (Post-Pretext-engine-path, src/layout/measure.ts) honors the element's white-space value rather than always collapsing
- [ ] Corpus corpus/white-space/ with four-layer fixtures (pre text with newlines/indent, nowrap overflowing label, pre inside a fixed-width box) and npm run verify:white-space exiting 0 against Chrome per charter §2

## Verification

npm run build passes. npm run verify:white-space exits 0: pre text breaks where Chrome breaks it (line rects within 0.5px), nowrap text overflows without wrapping as Chrome does, and computed white-space values are exact. Existing verify scripts remain green.

## Prohibited Patterns

- Do not handle white-space by pre-splitting text in the fixture's html - the engine must honor the CSS value
- Do not implement pre by replacing spaces with non-breaking spaces in measurement
- Do not forget nowrap on mixed inline content (text + inline elements) or that pre preserves leading/trailing whitespace
