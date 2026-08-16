---
wait_human_start: false
wait_human_merge: false
dependencies: [text-measure-remaining-gaps]
---

# Task: Task: Per-glyph script-run font fallback in the paint path (drawText) to match the measurement seam

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

per-glyph-fallback shipped script-run splitting only to the measurement path: SkiaCanvas.measureText (src/canvas/skia.ts:36) resolves runs via measureTextWithFallback (src/canvas/script-fallback.js), but drawText (src/canvas/skia.ts:53) still sets one font and paints the whole string. Mixed-script strings (Latin+CJK+emoji, Arabic+Latin punctuation) now measure at sub-pixel against Chrome yet paint with the wrong glyphs in the wrong face — a live measure-vs-paint asymmetry. Layer 4 only tolerates it because text pixels sit under the tiered text-region allowance (tolerances.json v2); that tier documents a rasterizer gap, not a license for wrong glyphs. The fix shares the measurement shim's run resolution with the paint path: split the paint string into the same script runs, paint each run at its accumulated advance with its resolved face, so painted glyphs match the measured width and Chrome's per-glyph fallback. Depends on text-measure-remaining-gaps so the tab/letter-spacing work settles the measure seam first (both edit src/canvas/skia.ts and would conflict if concurrent).

## Requirements

- [ ] drawText splits its string into the same script runs and per-run faces that the measurement shim resolves, painting each run at its accumulated advance with its face — one run-resolution authority shared by measure and paint, not two copies.
- [ ] A gate script (scripts/verify-paint-fallback.mjs, mirroring the verify-font-registration.mjs pattern) asserts drawText and measureText route run resolution through the same function and that per-run painted advances sum to the shimmed measureText width for a set of mixed-script strings.
- [ ] A paint-text corpus fixture with mixed-script strings (Latin+CJK+emoji; Arabic+Latin punctuation) records its painted advance positions and text-tier pixel numbers rather than being masked.
- [ ] The paint path uses only the Canvas interface primitives — src/canvas/interface.ts stays implementation-neutral (no skia-specific types).
- [ ] No regression: single-face strings paint glyph-identically to today; verify:paint-text and the existing four-layer fixtures stay green.
- [ ] Update docs/ledgers/fonts.md (or text-mask.md) recording the paint-run decision — measure and paint now resolve the same per-run faces.

## Verification

npm run build passes. node scripts/verify-paint-fallback.mjs exits 0 (the daemon's session-idle hook runs it for *paint-run-fallback* task names). npm run verify:paint-text green. The mixed-script fixture's painted advance positions match the shimmed widths, and its screenshot gate reports text-tier numbers rather than masking them.

## Prohibited Patterns

- Do not introduce skia-specific types into src/canvas/interface.ts — it stays implementation-neutral.
- Do not fork the script-run logic into paint — measure and paint must share one run-resolution authority.
- Do not weaken the layer-4 tolerances (delta-E ≤ 2, ≤ 1% exceeding) to pass.
- Do not special-case per-string — run resolution is general and script-run based.
