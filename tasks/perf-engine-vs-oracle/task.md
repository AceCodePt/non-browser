---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Recalculate engine vs Playwright-oracle time honestly: render cost, harness overhead, and whether the solution is faster

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The question to answer: time-wise, is our solution more efficient than getting the same information from the browser? The existing parity.md Performance section measured engine layout+paint vs the full Playwright harness (65ms vs 1809ms, ~28x) but conflates Chrome's own render cost with harness overhead (page load, fonts.ready, per-quantity evaluate round-trips, screenshot). This task recalculates with a fair split: (a) engine end-to-end (parse + cascade + layout + paint → buffer), (b) Chrome's actual render cost to first paint for the same HTML (measured inside the page, not harness wall-clock), and (c) Playwright harness overhead (oracle cost minus Chrome's render cost) — so we know how much of the 28x is the engine being fast vs the harness being slow.

## Requirements

- [ ] Add a benchmark script (e.g. scripts/bench-engine-vs-oracle.mjs) that, for the spine fixtures, measures: engine wall-clock (parse→layout→paint→buffer), Chrome render time to first paint (PerformanceObserver/RFT inside the page, not harness wall-clock), and the full Playwright oracle path exactly as the verify harness does it.
- [ ] Report per fixture and aggregate: engine, Chrome-render, and harness numbers plus the three ratios (engine:Chrome-render, harness:Chrome-render, engine:harness) for both cold and warm runs.
- [ ] Show how much of the harness cost is per-quantity evaluate round-trips by batching all oracle quantities into a single evaluate per fixture and reporting the delta.
- [ ] Rewrite the Performance section of docs/ledgers/parity.md with the honest split, answering whether the solution is time-efficient for the actual render work and where harness overhead dominates.

## Verification

npm run build passes; the benchmark script runs and writes its numbers to docs/ledgers/parity.md; the report separates engine render, Chrome render, and harness overhead per spine fixture; npm run verify stays green (no engine change).

## Prohibited Patterns

- Do not tune the engine to game the benchmark — no timing-driven behavior.
- Do not remove the existing parity.md performance data before the replacement is measured.
- Do not count browser cold-launch against the engine without also reporting warm numbers.
- Do not change tolerances or fixtures in this task — measurement only.
