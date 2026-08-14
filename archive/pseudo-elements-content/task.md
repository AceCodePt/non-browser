---
wait_human_start: false
wait_human_merge: false
dependencies: [inline-block-layout]
---

# Task: Pseudo-Elements-Content

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. ::before/::after pseudo-elements with content are pervasive in real pages (icons, decorative text, clearfixes, counters) and the selector engine explicitly skips pseudo identifiers at src/cascade/selector.ts:85 (the ':' branch reads past the identifier and discards it). So a rule like "#x::after { content: '★' }" applies to nothing. This task adds pseudo-element matching and content generation, giving the engine a second kind of generated-content test on top of the existing marker work.

## Requirements

- [ ] The selector parser (src/cascade/selector.ts) matches ::before and ::after (and a bare :before/:after legacy form) instead of skipping the pseudo identifier
- [ ] content property parsed; content:none/normal produce no box, content: 'text' / content: "text" produce a generated inline box
- [ ] ::before generates its inline box before the element's other inline content and ::after after it, laid out and measured like normal inline content (rects within 0.5px of Chrome)
- [ ] Generated content inherits the element's font/color and honors author styles targeting the pseudo (e.g. color, font-size on ::after)
- [ ] Pseudo boxes participate in the screenshot diff under the current mask/tier policy so the generated glyphs are actually compared where unmasked
- [ ] Corpus corpus/pseudo-elements/ with four-layer fixtures (::after suffix text, ::before prefix, content:none, styled pseudo with color/size, pseudo on a block) and npm run verify:pseudo-elements exiting 0 against Chrome per charter §2

## Verification

npm run build passes. npm run verify:pseudo-elements exits 0: generated content lays out where Chrome puts it (rects within 0.5px), content:none produces no box, computed styles on the pseudo match Chrome, and the generated glyphs appear in the compared screenshot region. Existing verify scripts remain green.

## Prohibited Patterns

- Do not apply ::before/::after rules to the real element as if they were element styles - the content must be a generated inline box that lays out at the element's boundary
- Do not ignore the content property (content: '' vs content: 'text' vs none)
- Do not leave the selector parser silently skipping ':' when a pseudo is present - the parser must now consume and match it
