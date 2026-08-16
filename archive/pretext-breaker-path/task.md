---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: REDO (partial merge) — complete the shipped-Pretext breaker: wire layoutTextLines through the landed seam, land corpus/breaker + verify:breaker + drift gate + mean enforcement

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The original pretext-breaker-path task was merged and archived with only **scaffolding**: `src/pretext/index.ts` gained a reusable incremental breaker (`breakNextLine` over `layoutNextLineRange`/`materializeLineRange`) and `src/layout/measure.ts` gained the breaker-selection knob (`usePretextBreaker` defaulting true, `setUsePretextBreaker`/`applyBreakerFromEnv`, with `CASCADE_BREAKER=greedy` wired), plus root scratch files (probe-align.mjs, probe-breaker-tmp.mjs, probe-frags.mjs, probe-pre-wrap.mjs, probe-pre-wrap2.mjs). But the core requirement did not land: **`layoutTextLines` still breaks with the greedy `fillWordLines`/`wrapWords` and never calls the Pretext seam** — `breakNextLine` is imported but unused, and the knob has no call site. `corpus/breaker/`, `scripts/verify-breaker.mjs`, the drift gate, the layer-1 mean enforcement, and the performance guard are all absent. The merge passed on default `npm run verify` (unchanged engine, still green) — the same partial-archive pattern the empty-archive audit exists to catch. This REDO completes that scope by **reusing the landed seam** rather than re-implementing it.

## Requirements

- [ ] `layoutTextLines`' word-fill breaks through the landed Pretext seam (`breakNextLine`, src/pretext/index.ts) driven by `usePretextBreaker` (already default true), so block-inline.ts:975, flexbox.ts:192 and grid.ts:140 all break text via the same Pretext path. The Chrome-parity layers stay owned by layoutTextLines: float-intrusion (the available(top,bottom) callback), per-word stretched advances for text-align: justify, and the per-mode white-space handling (normal/nowrap/pre/pre-wrap/pre-line, incl. the pre-wrap hung-space union line box and the alignment-with-overflow rules). The Pretext swap replaces only the break/word-fill decision; it does not delete these layers.
- [ ] The greedy wrapper remains the flagged fallback via the landed knob (default Pretext; `applyBreakerFromEnv` already honors `CASCADE_BREAKER=greedy`). Its engagement rule is explicit: it runs only for breaks/scripts Pretext's prepare produces no break opportunity for, documented per mechanism in docs/ledgers/breakers.md — the drift gate (below) asserts fallback and Pretext agree on the spine corpus.
- [ ] verify-four-layer.mjs and verify-firefox.mjs stop carrying their own separate Pretext call — the engine path is what is verified, so there is one breaker under test.
- [ ] The layer-1 mean tolerance (<=0.01px) is enforced wherever the charter requires it, not just the <=0.5px max (verify-four-layer.mjs currently gates maxDelta only; verify:text-measure likewise only reports the mean).
- [ ] A breaker corpus (corpus/breaker/) with long paragraphs, CJK-without-spaces, long words, hyphens, overflow-wrap:break-word and forced breaks, compared to Chrome's real line fragments; npm run verify:breaker reports line-count and break-position deltas per fixture.
- [ ] Divergences are patched at the Pretext-config level (wordBreak/overflow-wrap options); any remaining divergence is documented in docs/ledgers/breakers.md with concrete inputs.
- [ ] A drift gate asserts the fallback and Pretext paths agree on line counts/widths for the spine corpus so the fallback cannot silently diverge.
- [ ] A performance guard: scripts/bench-engine-vs-oracle.mjs records engine render time for the spine fixtures before and after the swap; the Pretext path must not regress the engine:CRO ratio beyond a documented, recorded amount, and the number is recorded in docs/ledgers/parity.md.
- [ ] Pass criterion: line-count parity on >=95% of breaker-corpus fixtures; every mismatch has a docs/ledgers/breakers.md entry explaining the cause.
- [ ] Remove the root scratch files the partial merge committed (probe-align.mjs, probe-breaker-tmp.mjs, probe-frags.mjs, probe-pre-wrap.mjs, probe-pre-wrap2.mjs) — root stays clean of probe debris.

## Verification

npm run build passes (tsc strict). node scripts/verify-breaker.mjs exits 0 (the daemon's session-idle `*pretext-breaker*` case runs it): >=95% of corpus/breaker fixtures line-break identically to Chrome, and docs/ledgers/breakers.md documents every known divergence with a sample input. npm run verify:four-layer exits 0 with the engine breaking text through Pretext AND the mean tolerance enforced; npm run verify:text-measure green with the <0.01px mean enforced; verify:layout-flexbox, verify:layout-grid, verify:layout-positioning all exit 0 (they share the breaker). The drift gate fails loudly if the fallback and Pretext diverge on the spine corpus. grep across src/layout shows no hand-rolled wrapping on the Pretext path (the word-fill routes through breakNextLine). git diff vs base shows the root probe-*.mjs debris removed.

## Prohibited Patterns

- Do not fork @chenglou/pretext source — divergences are patched via configuration/options or documented as known gaps.
- Do not change the Canvas interface or measureText behavior — that is text-measure-corpus scope.
- Do not keep two enforced tolerance bands for the same breaking decision.
- Do not weaken charter tolerances to make the drift gate or the seam pass.
- Do not delete or bypass the float-intrusion / justify / hung-space / alignment layers of layoutTextLines when wiring Pretext — those are Chrome-parity semantics the breaker swap must preserve.
- Do not re-implement or delete the landed seam — reuse `breakNextLine` and the `usePretextBreaker` knob; this task completes the wiring, it does not reinvent them.
