---
wait_human_start: false
wait_human_merge: false
dependencies: [ua-stylesheet-defaults]
---

# Task: Lists-Markers

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. Lists (ul/ol/li with markers) are among the most common real-world page elements, and the engine has no marker handling at all: no list-style parsing, no marker boxes, no indent. This lands after ua-stylesheet-defaults, which supplies the baseline list padding/marker defaults; this task makes markers real (marker box in the margin/outside position, disc/decimal/none/square, nested list renumbering for ol).

## Requirements

- [ ] list-style-type parsed for ul/ol/li (disc, decimal, square, none, circle) with Chrome's computed list-style-type behavior
- [ ] Marker boxes laid out outside the item content (marker position outside by default) at the position and size Chrome uses, so rects match within 0.5px
- [ ] Ordered lists renumber markers (1., 2., ... ) matching Chrome including nested lists
- [ ] list-style-position: inside/outside both supported with correct marker location vs the text box
- [ ] Corpus corpus/lists/ with four-layer fixtures (basic ul, ol, nested, inside-position, none-marker) and npm run verify:lists exiting 0 against Chrome per charter §2
- [ ] Marker rendering (if rasterized) participates in the screenshot diff under the same Skia-vs-Skia band as the rest of the paint layer

## Verification

npm run build passes. npm run verify:lists exits 0: all corpus/lists fixtures match Chrome on computedStyle (exact) and rects (<=0.5px); ol marker text (1. 2. 3.) matches Chrome's numbering including a nested ol. Existing verify scripts remain green.

## Prohibited Patterns

- Do not render markers as text nodes inside the li content box - a marker is a separate box in the marker position per css-lists-3
- Do not bake marker glyphs into the page text so that measurement alone passes; the marker's position/size must be laid out
- Do not implement only disc for ul and skip ol decimal renumbering
