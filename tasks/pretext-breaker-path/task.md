---
wait_human_start: true
wait_human_merge: false
dependencies: []
---

# Task: Pretext is the engine's line breaker: Pretext prepare/layout in the shipped path, mean tolerance enforced, breaker corpus and drift gate

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Charter §3 names @chenglou/pretext as the text-layout engine ("prepare/layout over the Canvas interface"), but today the shipped renderer never calls Pretext's breaker: renderHtml only installs the measurement shim (src/layout/render.ts:87), and block-inline.ts:975, flexbox.ts:192 and grid.ts:140 all break text with the hand-rolled greedy wrapper wrapWords/layoutTextLines in src/layout/measure.ts (break at spaces, fill to width — Chrome-exact only for simple space-separated Latin). Pretext's prepareText/layoutLines run only inside the verify scripts (verify-four-layer.mjs, verify-firefox.mjs, verify-segmenter.mjs) as a test seam, so break parity with Chrome is proven for a path the engine never ships. The two spec tasks that would fix this — pretext-engine-path and text-breaker-parity — were both archived unexecuted (git shows a task.md move only, no code merged). This task executes that scope: Pretext becomes the shipped breaker, the greedy wrapper is demoted to a flagged fallback, the layer-1 mean tolerance is actually enforced, and a breaker corpus proves line-count parity vs Chrome.

## Requirements

- [ ] layoutTextLines breaks through the @chenglou/pretext prepare/layout pipeline over the Canvas interface, so block-inline, flexbox and grid all break text via the same Pretext path. The wrapper's Chrome-parity semantics that Pretext's {text,width} line model does not provide stay owned by layoutTextLines: float-intrusion (the available(top,bottom) callback), per-word stretched advances for text-align: justify, and the per-mode white-space handling (normal/nowrap/pre/pre-wrap/pre-line, incl. the pre-wrap hung-space union line box and the alignment-with-overflow rules). The Pretext swap replaces the break/word-fill decision; it does not delete these layers.
- [ ] The hand-rolled greedy wrapper is demoted to a flagged fallback (default off) with the flag defaulting to Pretext. Its engagement rule is explicit: it runs only for breaks/scripts Pretext's prepare produces no break opportunity for, documented per mechanism in docs/ledgers/breakers.md — the drift gate (below) asserts fallback and Pretext agree on the spine corpus.
- [ ] verify-four-layer.mjs and verify-firefox.mjs stop carrying their own separate Pretext call — the engine path is what is verified, so there is one breaker under test.
- [ ] The layer-1 mean tolerance (<=0.01px) is enforced wherever the charter requires it, not just the <=0.5px max (verify-four-layer.mjs currently gates maxDelta only).
- [ ] A breaker corpus (corpus/breaker/) with long paragraphs, CJK-without-spaces, long words, hyphens, overflow-wrap:break-word and forced breaks, compared to Chrome's real line fragments; npm run verify:breaker reports line-count and break-position deltas per fixture.
- [ ] Divergences are patched at the Pretext-config level (wordBreak/overflow-wrap options); any remaining divergence is documented in docs/ledgers/breakers.md with concrete inputs.
- [ ] A drift gate asserts the fallback and Pretext paths agree on line counts/widths for the spine corpus so the fallback cannot silently diverge.
- [ ] A performance guard: scripts/bench-engine-vs-oracle.mjs records engine render time for the spine fixtures before and after the swap; the Pretext path must not regress the engine:CRO ratio beyond a documented, recorded amount (Pretext prepare/layout is heavier than the greedy loop), and the number is recorded in docs/ledgers/parity.md.
- [ ] Pass criterion: line-count parity on >=95% of breaker-corpus fixtures; every mismatch has a docs/ledgers/breakers.md entry explaining the cause.

## Verification

npm run build passes (tsc strict). npm run verify:four-layer exits 0 with the engine breaking text through Pretext and the mean tolerance enforced. npm run verify:text-measure is green with the <0.01px mean enforced. verify:layout-flexbox, verify:layout-grid, verify:layout-positioning all exit 0 (they share the breaker). npm run verify:breaker exits 0: >=95% of corpus/breaker fixtures line-break identically to Chrome, and docs/ledgers/breakers.md documents every known divergence with a sample input. The drift gate fails loudly if the fallback and Pretext diverge on the spine corpus. grep across src/layout shows no hand-rolled wrapping on the Pretext path; measure.ts's public surface still serves the callers.

## Prohibited Patterns

- Do not fork @chenglou/pretext source — divergences are patched via configuration/options or documented as known gaps.
- Do not change the Canvas interface or measureText behavior — that is text-measure-corpus scope.
- Do not keep two enforced tolerance bands for the same breaking decision.
- Do not weaken charter tolerances to make the drift gate or the seam pass.
- Do not delete or bypass the float-intrusion / justify / hung-space / alignment layers of layoutTextLines when wiring Pretext — those are Chrome-parity semantics the breaker swap must preserve.
