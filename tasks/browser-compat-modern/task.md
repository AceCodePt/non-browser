---
wait_human_start: true
wait_human_merge: false
dependencies: []
---

# Task: Modern-browser compatibility program (non-legacy surface)

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The engine is Chrome-parity on its authored corpus but that corpus only exercises the implemented surface. The real web platform is far larger, and the project decided to pursue it under an explicit policy: advance toward modern-browser compatibility for the spec-current, non-legacy surface only, and make foot-guns deliberately unsupported instead of "deferred gaps". Decisions locked in: deprecated HTML elements and legacy syntax are removed (not just unadded) and the exclusions are documented in the README; comma rgb()/rgba() is kept (not legacy); the quirky __qem margin-collapse stays (it is current Chrome rendering, not legacy); !important, @layer, transforms/transitions/animations, SVG, filters, image decode, DPR, and @font-face font loading are intentionally unsupported — the last group because a static pixel-buffer renderer has no better representation for them. This spec is the anchor: every vertical slice blocks on it.

## Requirements

- [ ] The engine advances toward modern-browser compatibility across the non-legacy surface; every feature added is spec-current (CSS Values/Selectors/Backgrounds/Text/Table/Cascade current modules, HTML5), never a deprecated or legacy mechanism.
- [ ] Each vertical slice is a complete path through every layer (parse → cascade → layout → paint), lands its own corpus directory under corpus/<feature>/, a verify script scripts/verify-<feature>.mjs wired into package.json, and a charter §11 coverage-matrix row with a corpus token, per repo convention.
- [ ] !important and cascade layers (@layer) are intentionally unsupported by design, documented in the charter §11 deferred ledger as 'by design, not a gap' rather than 'not implemented'.
- [ ] The chartered-out surfaces stay out and are documented as unsupported: transforms/transitions/animations, SVG, filters, image decoding, DPR scaling, @font-face font loading.
- [ ] Legacy surface is unsupported and documented in the README: deprecated HTML elements, presentational attributes, vendor-prefixed properties, and legacy-only CSS syntax. comma rgb()/rgba() remains supported (explicitly not treated as legacy).
- [ ] README documents every excluded surface so 'admitted/not supported' is stated, and check-charter.mjs remains green after each slice (no claim drifts from engine or corpus).
- [ ] The existing quirky UA margin-collapse behavior (__qem) and comma rgb()/rgba() support are preserved as current-Chrome parity.
- [ ] wait_human_start is true for every task in this program; wait_human_merge is false — the human starts each slice, the scheduler-verified work merges on its own.

## Verification

node scripts/check-charter.mjs exits 0 with every slice's coverage-matrix row present and token-backed. npm run verify:<slice> exits 0 for each landed slice. README and the charter §11 deferred ledger list every excluded surface (legacy elements/attributes/prefixed props, !important, @layer, and the chartered-out surfaces) as intentionally unsupported. A declared legacy-divergence fixture and ledger entry exist where a removed legacy feature intentionally diverges from Chrome.

## Prohibited Patterns

- Do not implement !important or @layer under any circumstance — they are unsupported by design; never present them as a 'future gap'.
- Do not add support for deprecated HTML elements (center, font, marquee, big, blink, strike, tt, plaintext, xmp, nobr) or presentational attributes (align, bgcolor, vspace, hspace, cellpadding, cellspacing, table width/height).
- Do not add vendor-prefixed properties (-webkit-*, -moz-*, -ms-*) or legacy-only CSS (zoom, display: run-in, ...).
- Do not weaken or remove the __qem quirky-margin behavior or comma rgb()/rgba() parsing — both are current-Chrome parity, not legacy.
- Do not delete a fixture or ledger entry as a way to hide a divergence — declared typed gaps and documentation are the only sanctioned way to record intentionally-divergent behavior.
- Do not weaken check-charter.mjs enforcement or add a matrix row without a corpus fixture exercising its token.
- Do not claim the chartered-out surfaces (transforms/animations/SVG/filters/image-decode/DPR/@font-face) as in scope.
