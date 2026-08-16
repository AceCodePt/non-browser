---
wait_human_start: false
wait_human_merge: false
dependencies: [coverage-matrix-sweep]
---

# Task: Ua-Stylesheet-Defaults

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

95%+ browser parity push (docs/improvement-plan.md). The engine has NO UA stylesheet at all: package.json's description claims "UA stylesheet" as a feature, but no code implements it. A browser renders every page against built-in defaults (h1-h6 font sizes/margins, p margins, ul/ol padding + disc markers, strong/b/em styling, pre, blockquote, hr, form controls). Without these, even a trivial page like "<h1>Hi</h1><p>body</p>" diverges from Chrome on computedStyle and rects. This is the single highest-leverage gap for parity on real-world HTML. The charter (docs/charter.md §1) lists the UA stylesheet among cascade outputs, and the corpus model expects corpus/<feature>/ fixtures with four-layer expectations.

## Requirements

- [ ] A UA stylesheet module (e.g. src/cascade/ua.ts) defines built-in default styles for the common elements: h1-h6 (font-size/margins), p, ul/ol/li (list-style, padding), strong/b/em/i (weight/style), pre, blockquote, hr, a (color/underline), and form-ish defaults where cheap
- [ ] UA defaults apply with the lowest cascade priority, below any author or inline style, matching how browsers layer the user-agent origin
- [ ] Default font-size scaling matches Chrome's UA behavior: headings map to the initial font size (h1 2em, h2 1.5em, etc.) exactly as getComputedStyle reports
- [ ] Corpus corpus/ua-styles/ with four-layer fixtures: bare headings, bare paragraphs, ul/ol/li, nested lists, strong/em/pre/hr, each diffed against Chrome (verify:ua-styles)
- [ ] A verify script (npm run verify:ua-styles) renders corpus/ua-styles/ and exits 0 only when every layer matches Chrome within charter §2 tolerances
- [ ] npm run verify still green after UA styles land (existing fixtures that relied on the previous no-UA behavior are updated only where the new default is actually correct for Chrome)

## Verification

npm run build passes. npm run verify:ua-styles exits 0: for every corpus/ua-styles fixture, computedStyle matches Chrome exactly (layer-2) and rects within 0.5px. A bare "<h1>Title</h1><p>body</p>" page's computed h1 font-size/margins match Chrome's UA values. npm run verify exits 0 on the full existing corpus after any justified fixture updates.

## Prohibited Patterns

- Do not hard-code per-fixture margins in fixtures to fake UA behavior - the defaults must come from a real UA stylesheet module
- Do not weaken the exact computedStyle layer-2 comparison to get headings/paragraphs to pass
- Do not implement UA styles as a hardcoded special-case in block-inline.ts; put the defaults in a dedicated module (e.g. src/cascade/ua.ts) applied before author styles
