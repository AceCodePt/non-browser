---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Text-Breaker-Parity

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Pretext's line breaker is its own approximation of browser breaking (segment widths + glue rules), not Blink's line-breaker (ICU line-break iteration + dictionary CJK breaking). Even with identical measureText, wrap points can differ on edge strings. This task measures that gap against Chrome and patches at the Pretext-config level. Owning module text/breaker/, corpus/breaker/.

## Requirements

- [ ] Line-break corpus (long paragraphs, CJK without spaces, long words, hyphens, overflow-wrap:break-word cases, forced breaks) laid out with Pretext at several widths and compared to Chrome's actual line breaks (via getClientRects/getBoundingClientRect in the oracle)
- [ ] Comparison script (npm run verify:breaker) reports line-count and break-position deltas per fixture
- [ ] Divergences reduced where achievable via Pretext options (wordBreak/overflow-wrap config); remaining gaps documented with concrete examples in docs/ledgers/breaker.md
- [ ] Pass criterion: line-count parity on >=95% of corpus fixtures; every mismatch has a ledger entry explaining the cause (Pretext approximation vs Blink behavior)

## Verification

`npm run verify:breaker` exits 0: >=95% of fixtures line-break identically to Chrome, and docs/ledgers/breaker.md documents every known divergence with a sample input.

## Prohibited Patterns

- Do not fork @chenglou/pretext source in this repo; divergences are patched via configuration/options, or documented as known gaps
- Do not change the Canvas interface or measureText behavior — that is text-measure-corpus scope
