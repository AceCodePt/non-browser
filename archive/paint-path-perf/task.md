---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Paint-path perf: renderHtml within reach of Chrome's render-to-FCP on page-scale fixtures

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

After measure-fastpath-cache (merged, verified) the text-measure seam is ~29x cheaper and layout collapsed from up to ~163ms to 3-33ms, so the engine now wins or ties Chrome's render-to-FCP on most MOBILE stress fixtures. The remaining bottleneck is the paint stage, which now dominates renderHtml: paint marginal is 47-64ms at desktop viewports and 11-23ms at mobile, leaving the engine ~2.0-2.4x behind Chrome FCP on the big pages (kitchen-sink@1280x800: renderHtml ~93ms vs Chrome FCP ~43ms; @320x568: ~57ms vs ~28ms; article@1280: ~71ms vs ~29ms). Instrumentation of kitchen-sink@320x568 renderHtml (~57ms): canvas.toBuffer('image/png') PNG encode measures ~8.4ms at 320x568 and ~45.9ms at 1280x800 (the largest single paint cost at desktop); renderHtml makes 727 measureText calls totalling ~13.4ms (mostly layout breaking re-measuring ~667 distinct break-candidate strings per render — paint itself adds only ~60 fresh); drawText raster is cheap (113 calls, ~3.8ms); the residual ~10ms is the per-element paint walk (fragment/generated-text collection, compositing). The gap to Chrome is now entirely the painted-buffer path, not layout or measurement.

## Requirements

- [ ] Perf gate: renderHtml for corpus/stress/kitchen-sink mean over 5 renders < 60ms at 1280x800 (baseline ~93ms; Chrome FCP ~43ms) and < 48ms at 320x568 (baseline ~57ms; Chrome FCP ~28ms) — the engine's full painted render gets within ~1.4x of Chrome's render-to-FCP on the page-scale fixtures instead of ~2.0-2.4x.
- [ ] PNG encode is the largest single paint cost at desktop (~46ms at 1280x800): either cheapen it, make it lazy/optional without breaking the public rgba-PNG contract for package consumers, or add a raw-RGBA fast path that the perf bench measures (renderHtml keeps producing a correct PNG for the parity gates); document the choice and the measured encode share in docs/ledgers/parity.md.
- [ ] Paint stops re-measuring text that layout already measured: the ~60 fresh measureText calls during paint (and any per-run re-resolution) reuse layout's line/advance data instead of re-measuring; the rendered pixels are byte-identical.
- [ ] Byte-exact painted output: every screenshot gate stays green — verify:four-layer, verify:stress, verify:paint-text, verify:shadow, verify:opacity, verify:border-radius, verify:lists, verify:pseudo-elements, verify:media-queries, verify:overflow — plus verify:text-measure, verify:rect-contract, and node scripts/check-charter.mjs all exit 0; no width, rect, computed-style, or pixel drift.
- [ ] A gate script scripts/verify-paint-perf.mjs wired into package.json (verify:paint-perf) asserting the two renderHtml thresholds above, exits 0 on pass.

## Verification

npm run build passes. npm run verify:paint-perf exits 0 with kitchen-sink renderHtml mean over 5 < 60ms at 1280x800 and < 48ms at 320x568. All screenshot parity gates exit 0 (verify:four-layer, verify:stress, verify:paint-text, verify:shadow, verify:opacity, verify:border-radius, verify:lists, verify:pseudo-elements, verify:media-queries, verify:overflow) plus verify:text-measure and verify:rect-contract; node scripts/check-charter.mjs exits 0. The encode-lazy/raw-RGBA decision (if any) is documented in docs/ledgers/parity.md with a measured encode share.

## Prohibited Patterns

- Do not trade paint parity for speed — the screenshot gates are the contract; any pixel that is masked, excluded, or changed to make paint faster must be justified per fixture in a ledger, never silent.
- Do not weaken the perf gate (raise thresholds, shrink the fixture/viewport, or warm-cache around the measurement) to force a pass.
- Do not break the public rgba-PNG contract for package consumers — if encoding is skipped or made lazy, it must be an explicit opt-in or a separate entry point, with README and index.ts updated.
- Do not change any measured width, rect, computed-style, or laid-out geometry — layout outputs are frozen (already gated by verify:measure-perf and the parity suites); only the paint stage may change.
- Do not remove or weaken the measure-seam fast path / memoization that measure-fastpath-cache landed (already gated by verify:measure-perf) in order to claim a different win.
