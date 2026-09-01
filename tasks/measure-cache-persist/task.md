---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Make the measure memo survive repeated renders: conditional cache invalidation

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The measure-fastpath-cache memoization is effectively dead across renders: both invalidation paths fire unconditionally on every prepare(). setActiveBrowserConfig (browser-config.ts:72) always calls invalidateMeasureCache(), and render.ts:132 calls it with a freshly built config on every renderHtml/rectsOf; registerFont (skia.ts:228) always invalidates too, and render.ts:125 calls registerFont for every font each render. So the 2048-entry width memo and the family-has memo are wiped at the start of every render, never accumulating. Measured consequence: layout of corpus/stress/kitchen-sink@320x568 still makes ~727 fresh canvas measureText calls per render (2908 over 4 renders = zero cache hits) costing ~12.4ms of the ~31-37ms rectsOf (40%), and every fixture pays the same thrash (article@360: 545 calls/9.4ms; card-grid@360: 313 calls/2.2ms) even though the working set (~700 distinct break-candidate strings) is far below the 2048 cap. The per-call fast path made each call cheap (~0.017ms), but the cache provides ~zero cross-render benefit. The fix is pure cache-lifetime semantics: invalidate only when the config or the registered font set actually changes. Note: the 2048 cap does NOT need to change — the working set fits; the wipe is the whole problem.

## Requirements

- [ ] Conditional invalidation: setActiveBrowserConfig invalidates the measure cache only when the new config is functionally different from the active one (structural equality over fonts, fallback, defaultFamily, defaultFile, scriptFallback, scriptCoverage); registerFont invalidates only when the (filePath, familyAlias) pair is newly registered (track the registered set). A repeated render of the same HTML with the same config and fonts in one process no longer wipes the memo.
- [ ] Warm-render persistence gate, measured in this repo: rectsOf for corpus/stress/kitchen-sink@320x568 mean over 5 renders after one warmup render < 27ms (baseline ~31-37ms, of which ~12.4ms was the wiped-memo re-measurement), and canvas measureText calls during those timed warm renders < 100 each (baseline ~727/render).
- [ ] Byte-exact parity: verify:text-measure (96/96, mean Δ ~0.0025px), verify:four-layer, verify:stress, verify:segmenter, verify:breaker, verify:rect-contract, verify:font-registration, verify:firefox, verify:measure-perf, verify:paint-perf, verify:comments and node scripts/check-charter.mjs all exit 0 — widths, rects, computed styles, and screenshots byte-identical; config-switch invalidation is proven by verify:font-registration and verify:firefox, which switch configs mid-process.
- [ ] A gate script scripts/verify-measure-persist.mjs wired into package.json (verify:measure-persist) asserting the two numbers above, exits 0 on pass.

## Verification

npm run build passes. npm run verify:measure-persist exits 0 with warm kitchen-sink@320x568 rectsOf mean over 5 < 27ms and < 100 canvas measureText calls per timed warm render. npm run verify:text-measure, verify:four-layer, verify:stress, verify:segmenter, verify:breaker, verify:rect-contract, verify:font-registration, verify:firefox, verify:measure-perf, verify:paint-perf, verify:comments and node scripts/check-charter.mjs all exit 0.

## Prohibited Patterns

- Do not change any measured width, rect, or painted pixel — the memo is a pure cache of the same seam; only its lifetime changes, and every width it returns must be exactly what a cold call returns.
- Do not skip invalidation when the config or fonts genuinely change — a stale width surviving a real config or font switch is a correctness bug; the equality check must cover fonts, fallback, defaultFamily/defaultFile, scriptFallback, scriptCoverage, and the registered (filePath, alias) set.
- Do not weaken the gate (raise thresholds, shrink the fixture, or warm the cache inside the measurement window) to force a pass — the gate measures steady-state warm renders, not the first render.
- Do not touch Pretext's break decisions or rebuild break candidates from per-word advances — per-word reconstruction is out of scope; keep the change to invalidation semantics.
- Do not remove or weaken the single-face fast path or the width memo themselves (already gated by verify:measure-perf).
