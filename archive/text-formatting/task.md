---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: text-transform, text-indent, and word-spacing

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The engine implements text-align, letter-spacing, white-space, text-decoration, line-height — but not text-transform, text-indent, or word-spacing. These are common in real documents (uppercase headings, indented first lines, spaced letters). css-text-3 defines them: text-transform applies case mapping at the glyph level, text-indent offsets the first line (supporting hanging/each-line), word-spacing adds inter-word space. They belong together because they all feed the same inline measurement/layout path.

## Requirements

- [ ] text-transform: uppercase/lowercase/capitalize transforms text before measurement and paint, matching Chrome's computed strings (the computed value stays the keyword) and the painted glyphs within the text tier.
- [ ] text-indent (length or percentage) offsets the first formatted line of a block by the given amount, with hanging and each-line keywords behaving per css-text-3 §2.1 and gated against the oracle.
- [ ] word-spacing (length) adds spacing between words in a line, with the trailing-word behavior matching Chrome's measured layout.
- [ ] All three compose with text-align, white-space modes, RTL direction, and the Pretext breaker path without double-measuring.
- [ ] Corpus under corpus/text-formatting/ exercises each property alone and combined (transform+indent, rtl indent, justify+word-spacing); verify script scripts/verify-text-formatting.mjs compares computed styles, rects, line fragments, and paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-text-formatting.mjs exits 0 — computed styles match Chrome exactly, line-fragment rects are within the layer-3 band, and painted text is within the text tier. Existing text-align/white-space corpora stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement full-width or full-size-kana text-transform variants without a corpus fixture proving Chrome parity — scope to uppercase/lowercase/capitalize first and document the rest.
- Do not apply text-indent to the wrong lines — hanging and each-line change which lines get indented; get the first-line-only (default) case exactly right and gate the others against the oracle.
- Do not let word-spacing affect the last word's trailing advance or letter-spacing of punctuation differently from Chrome — gate word-spacing measurement against the measureText oracle.
- Do not regress the existing text-align/white-space corpora.
- Do not implement locale-aware case mapping beyond the default Unicode mappings unless a fixture proves it (no Turkish/ελληνικά special cases without evidence).
