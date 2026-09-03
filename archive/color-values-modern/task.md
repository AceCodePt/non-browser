---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Modern color values: hsl(), space-separated rgb(), hex4/8, named colors, currentColor

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

parseColor in src/layout/css.ts handles only hex 3/6-digit, legacy comma rgb()/rgba(), and ~8 named colors (plus transparent). Modern documents use hsl()/hsla(), space-separated rgb() with /alpha, 4/8-digit hex, currentColor, and the full CSS named-color set. This slice is a cross-cutting dependency: every property that consumes a color (color, background-color, borders, shadows, text-decoration) benefits, and the gradients slice blocks on it. Per the program decision, legacy comma rgb()/rgba() stays supported — it is not treated as legacy.

## Requirements

- [ ] hsl()/hsla() parse with hue angles (deg/rad/grad/turn and unitless), saturation/lightness percentages, and optional /alpha; computed-style serialization matches Chrome's getComputedStyle form.
- [ ] Space-separated modern rgb()/rgba() (rgb(10 20 30 / 50%)) and the /alpha syntax parse alongside the legacy comma form.
- [ ] 4-digit (#rgba) and 8-digit (#rrggbbaa) hex parse with correct alpha scaling (e.g. f = 255, f8 = 0x88 ≈ 53%).
- [ ] The full CSS named-color set (147 names incl. currentColor, transparent, rebeccapurple) resolves to sRGB values matching Chrome.
- [ ] currentColor is a first-class color value in every color-consuming position (color, background-color, border-*-color, box-shadow/text-shadow, text-decoration-color), resolving against the element's computed color.
- [ ] Invalid color values drop the declaration like Chrome (parse-error recovery), never silently becoming the black fallback.
- [ ] Corpus under corpus/colors/ exercises each syntax across color, background-color, border colors, and shadows; verify script scripts/verify-colors.mjs compares computed styles and non-text paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-colors.mjs exits 0 — computed-style strings match Chrome exactly for every color form, and non-text screenshot pixels are within tolerance. Existing color-consuming corpora (spine, border-radius, box-shadow, paint-text) stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not remove or regress legacy comma rgb()/rgba() — it stays supported by explicit decision (current usage, not legacy).
- Do not add color spaces that have no canonical sRGB serialization for the screenshot layer without documenting how the computed style and paint serialize them.
- Do not introduce a color function whose parse falls through to the current opaque-black fallback on invalid input without matching Chrome's declaration-drop behavior.
- Do not forget currentColor resolution in every color-consuming position (it must resolve against the element's computed color at used-value time).
- Do not add vendor-prefixed color functions.
