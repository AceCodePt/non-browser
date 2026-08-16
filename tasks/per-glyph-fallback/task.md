---
wait_human_start: false
wait_human_merge: false
dependencies: [font-registration-faces]
---

# Task: Per-glyph script-run font fallback through the measurement seam

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Root cause #1 of the hard layer-1 deltas: the engine resolves one CSS family to one registered face (resolveFontFamily, browser-config.ts:42) and shapes the whole string in that face, while Chrome splits mixed-script strings into script runs and resolves each run to a different face through fontconfig. That is exactly the mechanism behind the mixed-script gaps (Δ143px, Δ20px) and the Arabic-punctuation gap (Δ4.3px) in corpus/measure-corpus/known-gaps. Neither @napi-rs/canvas (no per-glyph fallback API — GlobalFonts is register/has/setAlias only) nor Pretext (measures through the same single-face seam) provides this today. The fix is a run-splitting shim at the single measurement choke point, SkiaCanvas.measureText (src/canvas/skia.ts:36), which both the engine's measureTextWidth (measure.ts:60) and the Pretext seam (pretext/index.ts:54) funnel through, so both inherit it. Depends on font-registration-gaps so the Thai/emoji faces are added to the fallback pool first (that task already closes Thai 7→5).

## Requirements

- [ ] Split any measurement string into script runs so each run is a single script (reuse Intl.Segmenter or a script classifier), then resolve each run's face deterministically through a per-script fallback preference layered on the browser-config (e.g. Thai→Noto Sans Thai, emoji→emoji face, Arabic-run ASCII→Latin face, CJK→Droid Sans Fallback, Latin→default family).
- [ ] Detect when the active face genuinely lacks a glyph for a run (so a face change is justified) instead of blindly splitting runs that a single registered face already covers.
- [ ] measureText on a mixed-script string returns the sum of per-run widths through the same Canvas interface — the engine measurement path AND the Pretext seam both measure the same per-run faces.
- [ ] Close the three known-gaps entries of this class: both mixed-script entries and the Arabic-punctuation entry flip from the fail list to the pass corpus (corpus/measure-corpus/known-gaps), with deltas ≤ 0.5px.
- [ ] Update docs/ledgers/text-measure.md and fonts.md: known-gaps count 5 → 2, record the run-splitting and per-script fallback decisions.

## Verification

npm run build passes. npm run verify:text-measure green with known-gaps count 5 → 2 (mixed-script ×2 and Arabic-punctuation closed; Thai+emoji closed by font-registration-gaps; tabs and Arabic letter-spacing remain typed gaps). The three reclassified strings report deltas ≤ 0.5px. npm run test:probe and the four-layer verifiers stay green — the engine and the Pretext seam measure the same per-run faces on multi-script strings.

## Prohibited Patterns

- Do not weaken the layer-1 tolerance (mean ≤ 0.01px, max ≤ 0.5px) to make the fixtures pass.
- Do not introduce skia-specific types into the Canvas interface — src/canvas/interface.ts stays implementation-neutral.
- Do not hard-code per-string special cases — fallback must be general and script-run based.
- Do not regress the pass corpus: all existing single-script pass strings must stay sub-pixel; the shim must be a no-op when the active face covers the whole run.
- Do not delete a known-gaps entry before its divergence first closes (the fixture asserts each still diverges).
