---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Text measurement perf: single-face fast path + width memoization

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

A per-category engine-vs-Chrome-vs-harness timing investigation (throwaway probe, since removed) found the engine's layout stage on page-scale fixtures is dominated by text measurement: one kitchen-sink layout makes 667 CanvasLike.measureText calls totalling ~128ms of a ~143ms rectsOf run (~80%), and engine measureTextWidth costs ~0.33ms/call versus ~0.013ms for a raw skia ctx.measureText (~25x per-call overhead). The overhead is not the native canvas or JS-the-language: resolveFallbackRuns (src/canvas/script-fallback.ts) always pays full per-grapheme script-run resolution — Intl.Segmenter splitting, per-cluster classifyCluster, per-group fallback lookup, per-run font-string construction — even when the whole string is a single script run fully covered by the primary registered face; that single-face no-op is only detected AFTER all the segmentation work (line 236 returns null post-work). There is also no memoization, so Pretext break-candidate re-measures repeat everything. Result: the engine loses to Chrome's own render on page-scale HTML (kitchen-sink renderHtml ~191-250ms vs Chrome FCP ~28-43ms) even though it wins on small single-component layouts. This task makes the measure path cheap without changing a single width.

## Requirements

- [ ] Early single-face fast path: a string that is one script run fully covered by the primary registered face measures through a cheap single-pass check (e.g. char-class scan) that skips per-grapheme Intl.Segmenter splitting and classifyCluster, returning the plain native width — the no-op case resolveFallbackRuns currently discovers only after full segmentation must be detected before any segmentation. Mixed-script, out-of-face, and tab text still resolve runs exactly as today (script-fallback.ts and tabs.ts semantics unchanged).
- [ ] Width memoization: repeated measurements of the same (resolved family, size, text) — including Pretext break-candidate re-measures — hit a bounded cache that is invalidated whenever the active browser config or font registration changes (no stale widths across setActiveBrowserConfig/registerFont).
- [ ] Byte-exact parity: measureTextWidth returns identical widths for every corpus string; npm run verify:text-measure (96/96, mean Δ ~0.0025px), verify:four-layer, verify:stress, verify:segmenter, verify:breaker, verify:rect-contract, verify:font-registration, verify:firefox, verify:comments and node scripts/check-charter.mjs all exit 0 — no width, rect, screenshot, or computed-style drift.
- [ ] Perf gate, measured in this repo: mean measureTextWidth over 100 calls for a covered Latin sentence < 0.05ms/call (baseline ~0.33ms), and rectsOf for corpus/stress/kitchen-sink @320x568 mean over 5 renders < 60ms (baseline ~143ms) — text measurement is no longer the dominant layout cost (was ~80%).
- [ ] A runnable gate script scripts/verify-measure-perf.mjs wired into package.json (verify:measure-perf) that measures and asserts the two perf numbers above and exits 0 on pass.

## Verification

npm run build passes. npm run verify:measure-perf exits 0 with measureTextWidth < 0.05ms/call and kitchen-sink@320x568 rectsOf < 60ms. npm run verify:text-measure, verify:four-layer, verify:stress, verify:segmenter, verify:breaker, verify:rect-contract, verify:font-registration, verify:firefox, verify:comments and node scripts/check-charter.mjs all exit 0 (output byte-identical to before the change).

## Prohibited Patterns

- Do not change any measured width, rect, screenshot, or computed-style output — the fast path and cache must preserve byte-exact parity; the parity gates are the contract, not the perf gate.
- Do not bypass or fork Pretext's break decisions — the CanvasLike.measureText seam (src/canvas/script-fallback.ts, src/pretext/index.ts) keeps reporting the same widths; only the cost changes.
- Do not cache across browser-config / font-registration changes — a stale-width cache surviving setActiveBrowserConfig or registerFont is a correctness bug; keep the cache bounded (no unbounded per-string growth).
- Do not skip fallback resolution for mixed-script, tabbed, or out-of-face text — the fast path applies only to the exact single-script/single-face condition resolveFallbackRuns currently bails on.
- Do not weaken the perf gate (raise thresholds, shrink the measured string/render, or special-case the fixture) to force a pass.
