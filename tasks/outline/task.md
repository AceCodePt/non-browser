---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: outline property and paint (claims the ownerless surface)

## Metadata

- **Complexity:** Low
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

outline is the one ownerless surface in the archive audit — archive/paint-shapes is PARTIAL and the audit explicitly records "outline has no owner" (docs/ledgers/archive-audit.md:97). The engine has no outline parsing or paint. css-ui-4 §4 defines outline-width/style/color/offset and outline-style: auto. Outline does not affect layout (drawn outside the border box), so it is a paint-layer addition with a computed-style surface.

## Requirements

- [ ] outline-width/style/color parse and compute per css-ui-4 §4 with getComputedStyle parity (outline-style: auto computes to auto; outline-color: invert is not supported — matches Chrome's modern behavior of auto/currentColor default).
- [ ] outline paints outside the border box at outline-offset, following the border-radius contour at corners like Chrome.
- [ ] The outline shorthand parses (width/style/color in any order) and composes with border-radius, matching Chrome's raster within the pixel band.
- [ ] Layout is untouched: every fixture's rects are identical with and without outline.
- [ ] Corpus under corpus/outline/ exercises solid/dashed/dotted outline, outline-offset, and outline with border-radius; verify script scripts/verify-outline.mjs compares computed styles, rects, and non-text paint against Chrome; a charter §11 row with a corpus token is added.
- [ ] The archive-audit ownerless-outline note is resolved: this task owns outline.

## Verification

npm run build passes. node scripts/verify-outline.mjs exits 0 — computed styles match Chrome, rects are identical with/without outline, and non-text paint is within the pixel band. Existing border corpora stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not let outline affect layout geometry — outline is painted outside the border box and must not change any rect (getBoundingClientRect parity: rects are identical with or without outline).
- Do not implement outline as a border — it is a separate paint pass (non-rectangular corners, no inset/outset shading unless Chrome paints it that way).
- Do not implement outline-style: auto as a painted focus ring unless a fixture proves Chrome parity — record auto's raster as a declared divergence otherwise.
- Do not regress border painting while adding outline.
- Do not apply outline to elements with visibility issues the engine does not model (no visibility property yet).
