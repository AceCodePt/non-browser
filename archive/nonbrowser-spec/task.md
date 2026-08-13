---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: non-browser: browser-parity server-side renderer (charter)

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Project anchor. The effort: a server-side HTML/CSS renderer (npm TS library, no DOM, no Playwright in the product) that produces a static pixel buffer matching a target browser (Chrome first), fed by generic HTML/CSS strings or @ace-code/shast renderComponent output. Playwright remains a test-only oracle. Parity is measured across four layers: canvas measureText, getComputedStyle, getBoundingClientRect, and screenshot pixels. Constraints settled in grilling: full CSS layout (grid last), no animation/GPU/canvas-API-output/SVG, DPR 1, viewport is an input, images are empty replaced boxes (no decode in v1), fonts registered into the engine AND installed so the oracle resolves identical glyphs, text rides @chenglou/pretext over a generic Canvas interface (skia impl first, CoreText/HarfBuzz later), Safari track parked on macOS CI. Target: layout + metrics exact; rasterization Skia-vs-Skia absorbs the 5% band.

## Requirements

- [ ] docs/charter.md exists and states the four-layer parity model with concrete tolerances: measureText sub-pixel, getComputedStyle exact string equality, getBoundingClientRect <=0.5px, screenshot delta-E <=2 with <=1% pixels exceeding
- [ ] Charter lists constraints: no image decoding in v1, DPR 1, viewport is an input, <canvas> and <img> render as empty replaced boxes at layout size, no animation/GPU/canvas-API-output/SVG
- [ ] Charter defines the target browser contract: a browser-config parameter (chrome first; firefox later; safari parked on macOS CI) selecting fallback tables and golden corpora
- [ ] Charter defines input contract: HTML+CSS strings, from generic source or @ace-code/shast renderComponent output, both same strings
- [ ] Charter pins the runtime: Node >=20 full-icu, Intl.Segmenter required, process.versions.icu recorded in a ledger
- [ ] Charter names Playwright as test-only oracle, never a product dependency
- [ ] Charter defines the corpus layout: corpus/<feature>/ fixtures, one dir per independent task, four-layer expectations per fixture

## Verification

Run `node scripts/check-charter.mjs` — it must exit 0 after asserting docs/charter.md contains the four-layer model, the tolerance values, the browser-config contract, the input contract, the runtime pin, and the corpus layout. (This check script is added by the spine task, but the charter content must be complete enough to pass it.)

## Prohibited Patterns

- Do not start implementation; this task only produces the charter document
- Do not introduce Playwright as anything other than a documented test oracle
- Do not add image decoding, animation, GPU paths, SVG output, or canvas-API output to the charter as v1 scope
