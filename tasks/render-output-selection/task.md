---
wait_human_start: false
wait_human_merge: false
dependencies: [rtl-direction-layout]
---

# Task: Task: Selective render outputs — rectsOf/computedStylesOf entry functions over a shared pipeline core

## Metadata

- **Complexity:** Medium
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

The library's AI-agent pitch is "four independent answers" — text widths, computed styles, element rects, a painted buffer — but renderHtml always computes all of them: rects are collected inside paint() (so a rects-only caller pays for canvas raster + PNG encode it never uses), and computed styles are only reachable through the full layout+paint path even though computedStyleFor(style, props, refWidth, viewport) (src/layout/computed-style.ts:213) needs only the cascade, not the box tree. The dependency chain is strict: parse → cascade → measure → layout → paint; each stage consumes the previous. The chosen surface is the agent-preferred entry-function shape: keep renderHtml's default-everything behavior byte-identical, and add thin assertion-shaped entry functions (rectsOf, computedStylesOf) whose result shape is exactly the answer asked for — no flags-object tri-state, no negation. Low priority by decision: this is polish that sinks to the end of the queue (depends on the feature-chain tail).

## Requirements

- [ ] Extract the current renderHtml setup (parse, browser-config/font registration, measurement init, media cascade, resolveStyles) into a private `prepare` pipeline core shared by all entry functions.
- [ ] New `rectsOf(html, opts) → { width, height, rects }` — runs cascade + layout, stops before paint (no canvas, no PNG); rects are the border-box rects of every id-bearing element.
- [ ] New `computedStylesOf(html, opts) → { width, height, computedStyles }` — runs the cascade only, never lays out; `computedStyle` specs are required.
- [ ] `renderHtml` unchanged: same signature, byte-identical default output (backward compatible), sharing the `prepare` core.
- [ ] Move `collectRects` (src/layout/paint.ts:447, currently called from inside paint()) into the layout pass so rectsOf can collect without a canvas — a pure move, byte-identical results.
- [ ] README documents the three entry points, the cheap-call guidance for agents, and the invariant that computed style stays computed/specified values (so the styles-only fast path stays layout-free).
- [ ] scripts/verify-layers.mjs asserts selective output === full-call output byte-identical for every requested layer across the corpus, and records a measured cascade-vs-layout-vs-paint cost split per spine fixture in a ledger.

## Verification

npm run build passes. node scripts/verify-layers.mjs exits 0: for every corpus fixture, each layer produced by the selective entry equals the same layer from a full renderHtml call byte-identical, and the default full call is byte-identical to the pre-refactor output. The cost split (cascade vs layout vs paint per spine fixture) is recorded in a ledger. npm run verify stays green. The session-idle hook's *layers* case runs this gate.

## Prohibited Patterns

- Do not weaken charter tolerances.
- Do not change the default full path's behavior — renderHtml output must stay byte-identical.
- Do not special-case per fixture in the verify gate.
- Do not switch computed style to used-values — the styles-only path stays layout-free only while computed style reports computed/specified values.
- Do not fold textFragments/generatedTextRects/listMarkers into rectsOf v1 — it returns border-box rects only.
