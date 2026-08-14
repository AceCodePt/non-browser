---
wait_human_start: false
wait_human_merge: false
dependencies: [text-mask-parity]
---

# Task: Pretext-Engine-Path

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Improvement-plan §2 (docs/improvement-plan.md). The shipped render path breaks text with a hand-rolled greedy wrapper (wrapWords at src/layout/measure.ts:69, layoutTextLines at :103) called from block-inline.ts:490, flexbox.ts:261, grid.ts:196. Pretext's prepareText/layoutLines runs only inside verify-four-layer.mjs:179-223 as a verification-time check - the production engine never uses it, contradicting the charter's description of Pretext as the layout engine over the Canvas interface and measure.ts:7-10's own comment. Two tolerance bands exist: greedy-vs-Chrome gated at layer-3 (<=0.5px) and Pretext seam-vs-Chrome gated at layer-1 (<=0.01px mean) - but verify-four-layer.mjs:217-219 computes meanDelta and gates ONLY on maxDelta <= 0.5px, so the tight band is the one that isn't enforced (basic-text seam mean ~0.0117px is over the 0.01 band and the run is still green). This overlaps the archived-unexecuted hardening-core requirement #1.

## Requirements

- [ ] Pretext prepare/layout over the Canvas interface is the engine's text layout: the line/word wrapping inside src/layout/measure.ts (layoutTextLines) runs through the @chenglou/pretext prepare/layout pipeline, so block-inline, flexbox and grid all break text through the same Pretext path
- [ ] The hand-rolled greedy wrapper is demoted to a flagged fallback used only where Pretext does not yet cover breaking (e.g. non-Latin), with the flag defaulting to Pretext
- [ ] verify-four-layer.mjs stops carrying its own separate Pretext call - the engine path is what is verified, so there is one breaker under test
- [ ] The layer-1 mean tolerance (<=0.01px) is actually enforced where the charter requires it, not computed-and-ignored (verify-four-layer.mjs:217-219 currently gates only maxDelta)
- [ ] A drift gate asserts the fallback path and the Pretext path agree on line counts/widths for the Latin spine corpus so the fallback cannot silently diverge
- [ ] grep across src/layout shows no remaining hand-rolled wrapping on the Pretext path; measure.ts's public surface still serves the callers

## Verification

npm run build passes (tsc strict). npm run verify:four-layer exits 0 with the engine breaking text through Pretext and the mean tolerance enforced. npm run verify:text-measure is green with the <0.01px mean enforced. verify:layout-flexbox, verify:layout-grid, verify:layout-positioning all exit 0 (they share the breaker). The drift gate fails loudly if the fallback and Pretext diverge on the spine corpus (proved by a temporary forced divergence or the gate's own assertion in the task report).

## Prohibited Patterns

- Do not fork @chenglou/pretext source - divergence is handled via Pretext options or documented gaps
- Do not change the Canvas interface measureText behavior - that is text-measure-corpus scope
- Do not keep two enforced tolerance bands for the same breaking decision
- Do not weaken charter tolerances to make the drift gate pass
