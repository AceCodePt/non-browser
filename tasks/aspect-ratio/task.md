---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: aspect-ratio property and intrinsic-ratio sizing

## Metadata

- **Complexity:** Low
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

The engine has no aspect-ratio property (not in css.ts ComputedStyle, not resolved). Modern documents use aspect-ratio heavily for responsive media/cards. css-sizing-4 §5 defines it: the preferred aspect ratio fills in an auto dimension when the other is specified. It also applies to replaced elements via their intrinsic ratio (img/video). This slice lands the property and the intrinsic-ratio sizing rule for both replaced and non-replaced boxes.

## Requirements

- [ ] aspect-ratio parses (w / h, ratios, and the auto keyword for replaced elements) and is exposed in computed style matching Chrome's serialization.
- [ ] For a non-replaced box with a specified width and auto height (or height and auto width), the auto dimension derives from the aspect ratio, matching Chrome's rects.
- [ ] For replaced boxes (img/canvas) with an intrinsic ratio, aspect-ratio: auto preserves the intrinsic ratio; an explicit ratio overrides it when one dimension is auto.
- [ ] min-width/max-width/min-height/max-height clamp the ratio-derived dimension per css-sizing-4 §5.2.
- [ ] Corpus under corpus/aspect-ratio/ exercises width-specified, height-specified, both-specified, min/max interplay, and a replaced-element case; verify script scripts/verify-aspect-ratio.mjs compares rects and computed styles against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-aspect-ratio.mjs exits 0 — every fixture's border-box rects and computed aspect-ratio strings match Chrome within tolerance. Existing sizing corpora (flexbox min-max, stress) stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not apply aspect-ratio when both dimensions are specified or auto in the wrong combination — the ratio only fills an auto size per css-sizing-4 §5 (auto width with specified height, or auto height with specified width); content with a definite other axis wins.
- Do not let aspect-ratio affect min/max-width/height clamping incorrectly — min/max constraints clamp the ratio-derived size per spec.
- Do not implement ratio for zero-content boxes differently from Chrome (the transferred size rule), without a corpus fixture proving the divergence.
- Do not add object-fit/object-position — that is a separate replaced-content feature, out of scope here.
