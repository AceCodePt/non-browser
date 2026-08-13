---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Parse-Stylesheets

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Stylesheet parsing is the feed for every cascade phase. Uses css-tree (spec-tracking) to produce a stylesheet object the cascade consumes; handles @import, @supports, @font-face, and error recovery the way browsers do. Owning module cascade/parse/, corpus/stylesheets/.

## Requirements

- [ ] Stylesheet parser producing a typed rule tree (selectors, declarations, at-rules) from css-tree, validated against what the cascade phases consume
- [ ] @import resolution (inlined in order, cycle-safe), @supports evaluation against a capability set, @font-face collected into the font registry, @media/@container preserved as raw conditions for the media-queries phase
- [ ] Error recovery: malformed declarations/at-rules dropped like a browser, never aborting the parse
- [ ] Parse corpus fixtures (valid + malformed + @import chains) in corpus/stylesheets/ with expected outcomes verified against Chrome's applied styles via getComputedStyle
- [ ] npm run verify:stylesheets exits 0 on the corpus

## Verification

`npm run verify:stylesheets` exits 0: for every corpus fixture, the computed style of key nodes matches Chrome (via the harness layer-2 oracle) given the same stylesheet input.

## Prohibited Patterns

- Do not use postcss or a non-spec parser; css-tree only
- Do not implement cascade resolution in this task — emit the parsed rule tree for cascade phases to consume
