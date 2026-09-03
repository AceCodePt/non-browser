---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Remove legacy HTML element UA support and document the exclusions

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The engine's UA stylesheet (src/cascade/ua.ts) still carries legacy HTML elements: center, tt, dir, menu appear in UA rules (list markers, monospace, block display). The modern-compat program decided legacy support is removed, not just unadded, and every exclusion is stated in the README. This slice removes the legacy element UA special-casing, records the intentional divergence from Chrome (which still styles these elements), and documents the excluded set.

## Requirements

- [ ] Remove UA stylesheet rules and element lists for legacy elements (center, tt, dir, menu; confirm no other deprecated element is special-cased anywhere in src/).
- [ ] After removal, legacy elements render as generic boxes per the default-display logic (no list markers, no monospace face, no centering) — the modern-display contract.
- [ ] A corpus fixture under corpus/legacy-removal/ proves the removed elements render as generic boxes, with the expected divergence from Chrome recorded as a declared typed gap in the fixture (Chrome still styles these elements).
- [ ] README documents the removed legacy surface (elements + presentational attributes) as unsupported; the charter §11 deferred ledger records the intentional divergence.
- [ ] check-charter green: any coverage-matrix row or UA claim that named a removed element is updated or explicitly recorded as intentionally divergent.

## Verification

npm run build passes. node scripts/verify-legacy-removal.mjs exits 0: the fixture's rects/paint show legacy elements as generic boxes and the fixture's declared typed gap against Chrome is asserted (still diverging, on the record). node scripts/check-charter.mjs exits 0. README and docs/ledgers list the removed legacy surface.

## Prohibited Patterns

- Do not keep any UA rule, INLINE_TAGS/block list entry, or display default for deprecated elements (center, tt, dir, menu, font, marquee, big, blink, strike, plaintext, xmp, nobr).
- Do not consume legacy presentational attributes (align, bgcolor, vspace, cellpadding, cellspacing, table width/height) as presentational hints.
- Do not add support for vendor-prefixed properties or legacy-only CSS while removing legacy HTML.
- Do not delete the removal record — the intentional divergence from Chrome must stay documented in the README and a ledger.
- Do not change the __qem quirky-margin behavior or comma rgb()/rgba() — those are current-Chrome parity, not legacy.
