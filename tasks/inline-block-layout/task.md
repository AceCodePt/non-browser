---
wait_human_start: false
wait_human_merge: false
dependencies: [pretext-engine-path]
---

# Task: Inline-Block-Layout

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. display:inline-block is extremely common (buttons, badges, nav items) and the engine coerces it to block at src/layout/css.ts:873 (v === 'inline-block' returns 'block'). Real inline-block boxes flow inline with surrounding text, are sized by their content, and participate in the line box with baseline alignment - not as block boxes stacked on their own lines. This is a structural layout gap, not a paint one.

## Requirements

- [ ] display:inline-block parsed and NOT coerced to block; it produces a real inline-level box (src/layout/css.ts:873 coercion removed)
- [ ] Inline-blocks flow inline: they sit on the same line as surrounding text and other inline-blocks, wrap across lines, and respect inline whitespace
- [ ] Inline-block sizing matches Chrome: shrink-to-fit content width, respects width/height/margins, box-sizing as authored
- [ ] Baseline alignment of inline-blocks with surrounding inline content matches Chrome (per css-inline-3 baseline alignment), so text baselines align as the oracle does
- [ ] Corpus corpus/inline-block/ with four-layer fixtures (inline-block in text, sized badges, vertical-align with text, wrapping) and npm run verify:inline-block exiting 0 against Chrome per charter §2

## Verification

npm run build passes. npm run verify:inline-block exits 0: inline-blocks sit on the line with surrounding text (rect x/y within 0.5px), size shrink-to-fit, and baselines match Chrome. Existing verify scripts remain green.

## Prohibited Patterns

- Do not keep coercing inline-block to block (css.ts:873) - that line must change
- Do not implement inline-block as a float-like intrusion; it must sit inline within the line box
- Do not ignore whitespace/text between inline-blocks on the same line
