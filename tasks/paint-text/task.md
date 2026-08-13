---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Paint-Text

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Rasterization of text glyphs at layout-computed positions: draw each line's text through the Canvas interface at the correct baseline/line position, with text fill color, text-decoration (underline/strikethrough), and letter-spacing application. "Render it correctly" as the user put it — glyph positions come from layout, rasterization rides Skia. Owning module paint/text.ts, corpus/paint-text/.

## Requirements

- [ ] Draw each layout line at its computed position (x offset, line box y, baseline) using the same font resolution and registered fonts used at measure time
- [ ] text-decoration: underline/strikethrough rendered with correct geometry and color; overline if cheap
- [ ] letter-spacing applied at paint consistent with measure-time spacing
- [ ] Text fill color and opacity from computed styles
- [ ] Corpus corpus/paint-text/ (fixtures combining fonts, sizes, colors, decorations, letter-spacing); npm run verify:paint-text exits 0 with layer-4 screenshots within tolerance vs Chrome (text-region masks allowed per harness)

## Verification

`npm run verify:paint-text` exits 0: all corpus/paint-text fixtures match Chrome on layer-4 within the charter tolerance (using text-region masking where the harness supports it).

## Prohibited Patterns

- Do not re-measure text at paint time — consume line/width data produced by layout through the canvas
- Do not hand-roll glyph rasterization; use the Canvas interface's text drawing
- Do not implement background-image or complex effects
