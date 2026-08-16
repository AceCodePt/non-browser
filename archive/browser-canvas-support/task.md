---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Browser-config support through the engine and Pretext seam: Firefox exercised end-to-end, Safari to the extent of glyphs/correct canvas

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Cross-browser probe (probes/probe-browser-gap.mjs, run 2026-08-14) showed Chrome and Firefox are byte-identical on layout (rect max Δ 0.0000px, computedStyle 0 mismatches) and differ only sub-pixel on text width (mean Δ 0.001–0.10px), with the Courier New fallback fixture the single real measurement divergence (0.10px) — text rasterization diverges structurally but that is a pixel-level gap no font table closes. Conclusion: the browser-config/fallback mechanism matters only for font resolution, and feeding the correct per-browser canvas to Pretext is the right architecture for a multi-browser track. Today the firefox-config is exercised by verify-firefox.mjs through the engine path only; the Pretext seam is handed the hard-coded default family (verify-firefox.mjs:201, verify-four-layer.mjs:200), so the seam never exercises the fallback table. This task closes that: route the seam through the fixture's real CSS family, keep one font-resolution authority (resolveFontFamily) shared by the engine measure path and the seam, and extend the mechanism to Safari to the extent of glyph resolution using the correct canvas.

## Requirements

- [ ] One font-resolution authority: Pretext's measurement context resolves the CSS family through the active BrowserConfig (resolveFontFamily) before hitting the Canvas, identical to measureTextWidth — so the seam and the engine measure the same per-browser faces for any fixture family.
- [ ] The Pretext seam passes the fixture's real computed font-family (harvested from the element), not the hard-coded default family, in verify-firefox.mjs and verify-four-layer.mjs.
- [ ] Firefox config is exercised end-to-end through the seam: a firefox-track fixture whose element uses an unregistered family (e.g. Courier New) proves the seam resolves it through the firefox fallback table to Source Code Pro and matches Firefox's line fragments within the layer-1 mean tolerance.
- [ ] A regression gate: compareLayers (probes/lib) and the probe remain green, and a new probe fixture or firefox-track fixture fails if the seam measures a family the active config would resolve differently.
- [ ] Safari browser-config added to the extent of glyph resolution: src/config/safari.ts registers the faces WebKit resolves and carries a fallback table, and the correct safari-config canvas is pressed into Pretext so seam measurement resolves Safari's faces.
- [ ] The cross-browser probe covers the Safari target: probe-browser-gap.mjs runs the same fixtures against Chrome, Firefox and Safari and reports per-pair measurement deltas, documented in parity.md.

## Verification

npm run build passes (tsc strict). npm run verify:firefox and npm run verify:four-layer stay green with the seam resolving the fixture's real family. npm run test:probe is green (39 tests). npm run probe:browser-gap runs Chrome/Firefox/Safari and reports measurement deltas per pair; the firefox-track fallback seam fixture and the safari fixtures pass the layer-1 mean tolerance (≤0.01px) with the seam using the resolved family. Grep confirms no code path measures a CSS family without resolveFontFamily for the active config.

## Prohibited Patterns

- Do not reintroduce browser/skia-specific types into the Canvas interface (src/canvas/interface.ts stays implementation-neutral).
- Do not weaken charter tolerances to make the seam pass.
- Do not add a fallback-table entry that does not reproduce the target browser's advances to sub-pixel (per firefox.md, monospace/sans-serif/serif/Arial are deliberately unmapped).
- Do not change the chrome default config behavior (chrome path must stay byte-identical).
