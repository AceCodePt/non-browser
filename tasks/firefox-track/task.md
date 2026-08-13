---
wait_human_start: false
wait_human_merge: false
dependencies: [text-font-fallback]
---

# Task: Firefox-Track

## Metadata

- **Complexity:** Medium
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

The firefox browser-target config: per-browser fallback tables were established in text-font-fallback (chrome populated); this task adds the firefox path — the browser:'firefox' config selecting Firefox fallback tables and its golden corpus, verified via Playwright Firefox (which the user confirmed Playwright supports). Skia substrate shared with chrome per the grilling decision; only fallback/font config differs. Owns config/firefox.ts and corpus/firefox-track/.

## Requirements

- [ ] browser:'firefox' config path selects the firefox fallback table and firefox font-registration set, reusing the same skia Canvas interface and layout/paint pipeline
- [ ] Firefox fallback table populated for the common families/glyph-missing cases where Gecko resolves fonts differently from Blink
- [ ] Firefox golden corpus (corpus/firefox-track/) — a subset of the chrome corpus plus firefox-specific font-fallback fixtures — verified via Playwright Firefox on all four layers
- [ ] npm run verify:firefox exits 0 with the firefox corpus green within charter tolerances
- [ ] docs/ledgers/firefox.md records the fallback-table decisions and any fixtures that diverge between chrome and firefox configs with rationale

## Verification

`npm run verify:firefox` exits 0: the corpus/firefox-track fixtures pass all four layers against Playwright Firefox within charter tolerances.

## Prohibited Patterns

- Do not create a separate rasterization substrate for Firefox — reuse the skia Canvas interface, differ only in fallback/font config
- Do not change the chrome config or its corpus in this task
