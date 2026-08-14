---
wait_human_start: false
wait_human_merge: false
dependencies: [pretext-engine-path]
---

# Task: Text-Align-Inline

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. text-align (left/center/right/justify) is one of the most common CSS properties on the web, and the engine has no textAlign field in ComputedStyle and no alignment logic. Every centered heading, right-aligned label, or justified paragraph currently renders left-aligned - a guaranteed layer-2 and layer-3 divergence from Chrome on common pages. Applies to block containers' inline content, inline-blocks, and table-cells once those exist.

## Requirements

- [ ] text-align parsed into ComputedStyle (left/center/right/justify/start/end with LTR start=left, end=right) matching Chrome's computed value
- [ ] Left/center/right align each line box's content start within the block's content width, affecting the rect of every line fragment (layer-3)
- [ ] justify distributes inter-word spacing so the last line stays left-aligned, matching Chrome's measured line widths within the rect tolerance
- [ ] text-align applies to block containers and inherited to their inline content, including multi-line blocks (each line aligned independently)
- [ ] Corpus corpus/text-align/ with four-layer fixtures (center paragraph, right label, justify multi-line, nested alignment inheritance, mixed) and npm run verify:text-align exiting 0 against Chrome per charter §2

## Verification

npm run build passes. npm run verify:text-align exits 0: centered/right/justified text lines land where Chrome puts them (rect x/width within 0.5px, computedStyle exact). Existing verify scripts remain green.

## Prohibited Patterns

- Do not handle text-align by padding boxes to fake centering - line boxes must start at the aligned offset
- Do not implement justify as space-padding between words if Chrome's justification (inter-word spacing) differs - match the measured advance
- Do not ignore text-align on multi-line blocks (each line is aligned independently)
