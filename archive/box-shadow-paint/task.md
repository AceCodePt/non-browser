---
wait_human_start: false
wait_human_merge: false
dependencies: [text-mask-parity]
---

# Task: Box-Shadow-Paint

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. box-shadow is a very common visual effect (cards, buttons, popovers) and the engine has no shadow support at all: no box-shadow parsing, no shadow paint. Every card UI diverges at layer 4. This task adds box-shadow (and text-shadow) paint to the skia canvas interface, matching Chrome's shadow placement, blur, spread, and color.

## Requirements

- [ ] box-shadow parsed (offset-x/y, blur, spread, color, inset; comma-separated shadow lists) with computed values matching Chrome's getComputedStyle
- [ ] Shadows painted behind the box using the Canvas interface's shadow primitives, matching Chrome's placement/blur/spread within the charter §4 screenshot band
- [ ] inset shadows, multiple shadows (list order/stacking), and spread radius all supported
- [ ] text-shadow painted for text runs where supported by the same primitives, matching Chrome
- [ ] Corpus corpus/box-shadow/ with four-layer fixtures (offset shadow, blur, spread, inset, multiple, transparent-background shadow, text-shadow) and npm run verify:box-shadow exiting 0 against Chrome per charter §2/§4

## Verification

npm run build passes. npm run verify:box-shadow exits 0: shadow fixtures match Chrome's raster within the screenshot band (delta-E <=2, <=1% exceeding) with computed box-shadow strings exact. Existing verify scripts remain green.

## Prohibited Patterns

- Do not blur shadows by cheap approximations that diverge from Chrome's raster - use the canvas surface's shadow primitives the same way skia would
- Do not forget inset shadows, multiple shadows (shadow lists), or spread radius
- Do not paint shadows when the element has a transparent background in a way that diverges from Chrome's 'transparent' shadow rule
