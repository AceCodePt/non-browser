---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: word-break and overflow-wrap line-breaking

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The engine's line breaking goes through the Pretext breaker (layoutTextLines → breakNextLine) with white-space mode handling, but word-break and overflow-wrap are absent: long unbreakable tokens overflow the line instead of breaking (the one remaining declared breaker divergence, long-word-default in docs/ledgers/breakers.md, is exactly this class of behavior). css-text-3 §6 defines word-break (normal/break-all/keep-all) and overflow-wrap (normal/break-word/anywhere). These are the properties that fix overflowing long words and CJK token boundaries.

## Requirements

- [ ] word-break: break-all allows breaks between any characters (including within Latin words) and keep-all suppresses breaks within CJK runs, both matching Chrome's line fragments and line counts.
- [ ] overflow-wrap/word-wrap: break-word allows an otherwise unbreakable word to break when it cannot fit on its own line; anywhere allows breaks within the word and affects intrinsic sizing, matching Chrome.
- [ ] The interplay of word-break/overflow-wrap with white-space modes (normal/nowrap/pre-wrap) and with the existing Pretext breaker path behaves like Chrome.
- [ ] The long-word-default breaker divergence in docs/ledgers/breakers.md is re-evaluated: if overflow-wrap: break-word closes it, the typed gap flips to pass; otherwise the gap reason is updated to name the exact remaining property.
- [ ] Corpus under corpus/text-breaking/ exercises a long unbreakable word, CJK keep-all/break-all, and mixed overflow-wrap cases; verify script scripts/verify-text-breaking.mjs compares line fragments and line counts against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-text-breaking.mjs exits 0 — line counts and fragment rects match Chrome for every fixture. The breaker typed-gap ledger is updated to reflect any closed divergence. Existing breaker/white-space corpora stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not hand-roll a second breaker — extend the existing Pretext seam (src/layout/measure.ts) so word-break/overflow-wrap influence the break decisions.
- Do not silently change CJK line-breaking — keep-all must suppress breaks within CJK runs, and break-all must allow them, both gated against Chrome.
- Do not regress the existing breaker corpus (corpus/breaker, verify:breaker) or the white-space corpus.
- Do not claim overflow-wrap: anywhere and break-word are identical — anywhere breaks are usable by min-content sizing too; get break-word's behavior (only when a line cannot fit) exact.
- Do not widen the long-word-default typed gap without flipping it to pass — this slice is the candidate that closes it.
