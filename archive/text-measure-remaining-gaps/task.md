---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Task: Close the last two layer-1 known-gaps — proportional-tab advance semantics and joining-script letter-spacing

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

After per-glyph-fallback and font-registration-faces landed (known-gaps 7 → 2), corpus/measure-corpus/known-gaps/fixture.json holds exactly two entries: the proportional-font tab case ("\t\t\t" @ 16px 'Noto Sans', Δ16.32px) and the joining-script letter-spacing case ("مرحبا" @ 16px 'Droid Arabic Kufi', ls 1.5, Δ7.5px; per-string numbers in docs/ledgers/text-measure.md). Both live at the single measurement choke point SkiaCanvas.measureText (src/canvas/skia.ts:36), which the engine's measureTextWidth (src/layout/measure.ts:60) and the Pretext seam both funnel through.

Tabs: Chrome's canvas applies tab-stop semantics — a tab advances to the next tab stop — while skia returns the font's raw U+0009 advance. Monospace tabs already agree (corpus/measure-corpus/tabs/) because the raw advance equals the tab stop in those faces; the fix is tab-stop advance math at the measure seam (advance accumulation per run), not font resolution — that was per-glyph-fallback scope.

Arabic letter-spacing: Chrome does not apply ctx.letterSpacing to Arabic (a joining script), while the engine's measureTextWidth adds letterSpacing × text.length after every codepoint (measure.ts:64). The fix applies spacing only at non-joining breaks, matching Chrome, while Latin/CJK letter-spacing stays sub-pixel (corpus/measure-corpus/letter-spacing/).

## Requirements

- [ ] Reclassify the two remaining known-gaps entries (proportional tabs, Arabic letter-spacing) out of corpus/measure-corpus/known-gaps/fixture.json into the pass corpus with deltas ≤ 0.5px, per the fixture's sunset contract — no entry may be removed before its divergence first closes.
- [ ] Proportional-font tabs measure like Chrome: each tab advances to the next tab stop in the active face at the measure seam; monospace tabs (corpus/measure-corpus/tabs/) stay at the current sub-pixel agreement.
- [ ] Joining-script letter-spacing matches Chrome: letter-spacing is applied only at non-joining breaks (Arabic) rather than after every codepoint; Latin and CJK letter-spacing are unchanged.
- [ ] Both mechanisms are general (tab-stop math; joining-script detection) — no per-string special cases.
- [ ] The engine's measureTextWidth and the Pretext seam return the same per-string widths (both funnel through SkiaCanvas.measureText).
- [ ] Update docs/ledgers/text-measure.md: known-gaps count 2 → 0, record the reclassified strings and their post-fix deltas.

## Verification

npm run build passes. npm run verify:text-measure exits 0 with known-gaps count 0 and the two reclassified strings reporting deltas ≤ 0.5px (pass-corpus mean within the ≤ 0.01px charter band). npm run test:probe green. The daemon's session-idle hook maps *text-measure* task names to npm run verify:text-measure.

## Prohibited Patterns

- Do not weaken the layer-1 tolerance (mean ≤ 0.01px, max ≤ 0.5px) to make the fixtures pass.
- Do not delete a known-gaps entry before its divergence first closes — the verify script asserts each remaining entry still diverges.
- Do not hard-code per-string special cases — tabs and letter-spacing must be general mechanisms.
- Do not change font resolution or the fallback tables — that is per-glyph-fallback scope (already shipped).
