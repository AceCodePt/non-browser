---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Paint-Shapes

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Paint of non-text boxes: backgrounds (solid color only in v1 scope), borders, box-shadow, border-radius, outline — drawn through the Canvas interface onto the offscreen buffer at layout-computed rects. The 5% rasterization band applies, but layout-driven box geometry must be exact. Owning module paint/shapes.ts, corpus/shapes/.

## Requirements

- [ ] Background painting (solid color, background-clip/origin/position/size where layout supplies them), over the layout box rect
- [ ] Border painting: per-side width/style/color, collapsed vs separated handling for tables out of scope; border-radius clipping of background and borders
- [ ] box-shadow: offset, blur, spread, inset; matching Chrome's shadow geometry closely (rasterization band allowed)
- [ ] outline (offset/width/style/color)
- [ ] Paint order: background -> border -> shadow composition per CSS painting order for block boxes
- [ ] Corpus corpus/shapes/ (fixtures with inline-style boxes, colors, borders, radii, shadows); npm run verify:paint-shapes exits 0 with layer-4 screenshots within delta-E <=2 / <=1% tolerance vs Chrome

## Verification

`npm run verify:paint-shapes` exits 0: all corpus/shapes fixtures match Chrome on layer-4 within the charter tolerance.

## Prohibited Patterns

- Do not add background-image/gradient decoding in this task — solid colors only, document other backgrounds as a gap
- Do not draw text — that is paint-text scope
- Do not bypass the Canvas interface with engine-specific calls
