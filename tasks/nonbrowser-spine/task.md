---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spec]
---

# Task: Nonbrowser-Spine

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The architectural seam everything plugs into. Establishes the repo scaffold, the generic Canvas interface (so skia/CoreText/HarfBuzz implementations can plug in later), skia implementation, font registration, Pretext measureText, the four-layer parity harness vs Playwright Chrome, and a minimal end-to-end render (parse5 DOM + inline styles + block text layout + paint to PNG). Proves the seam before the parallel fan-out begins.

## Requirements

- [ ] Repo scaffold: package.json, TypeScript config, Node >=20 full-icu, npm scripts (verify, verify:four-layer), and a scripts/check-charter.mjs that passes per the nonbrowser-spec verification
- [ ] Generic Canvas interface defined (measureText + paint primitives: fill rect, draw glyphs/text, fill/stroke shapes, composite to pixel buffer) with no skia-specific types leaking into it
- [ ] skia implementation of the Canvas interface using @napi-rs/canvas or skia-canvas, offscreen only, with font registration from .ttf/.woff2 files
- [ ] Pretext integration: @chenglou/pretext prepare/layout over the Canvas interface's measureText; font string and registered fonts consistent with what is drawn
- [ ] Four-layer parity harness skeleton vs Playwright (headless Chrome): layer 1 measureText corpus comparison, layer 2 getComputedStyle, layer 3 getBoundingClientRect, layer 4 screenshot pixel diff with tolerance knobs
- [ ] Minimal end-to-end render path: parse5 DOM -> inline-style cascade -> block text layout -> paint -> PNG pixel buffer, with <canvas> and <img> rendered as empty replaced boxes at layout size
- [ ] Five spine fixtures in corpus/spine/ passing all four layers within the charter tolerances
- [ ] docs/ledgers/ directory created with placeholders for text-measure, icu, fonts, breaker ledgers

## Verification

Run `npm run verify:four-layer` — renders the five corpus/spine fixtures and diffs all four layers against headless Chrome (Playwright): measureText within sub-pixel, getComputedStyle exact, rects <=0.5px, screenshot delta-E <=2 and <=1% pixels exceeding. Must report green. `node scripts/check-charter.mjs` must pass.

## Prohibited Patterns

- Do not implement full cascade, flexbox, grid, floats, or positioning — only minimal block/inline text layout needed for the spine fixtures
- Do not add image decoding or canvas-API output
- Do not make Playwright a runtime dependency of the library — it is devDependencies/test-oracle only
- Do not hand-roll text shaping; measurement goes through Pretext over the Canvas interface
