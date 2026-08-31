---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Media query range syntax and modern feature set

## Metadata

- **Complexity:** Medium
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

The media query engine (src/cascade/media.ts) supports width/height/aspect-ratio/orientation/prefers-color-scheme/prefers-reduced-motion/resolution with min-/max- prefixes and and/or/not. It lacks the css-media-queries-4 range syntax in @media ((width >= 600px)) — currently range operators only parse inside @container (media.ts:19) — and the modern feature set: hover, pointer, any-hover, any-pointer, prefers-contrast, forced-colors, color-gamut, update. These gate responsive/adaptive design in real documents. The MediaEnvironment input needs the new feature inputs.

## Requirements

- [ ] Range syntax works in @media queries ((width >= 600px), (400px < width <= 800px), (<, >, <=, >=, =) ) and evaluates against the viewport input like Chrome.
- [ ] Features hover, any-hover, pointer, any-pointer, prefers-contrast, forced-colors, color-gamut, and update parse and evaluate against new MediaEnvironment inputs (with documented defaults), matching Chrome for the given input surface.
- [ ] prefers-color-scheme/prefers-reduced-motion/resolution keep working and compose with the new features via and/or/not.
- [ ] The media-query corpus gains range-syntax and new-feature fixtures.
- [ ] Corpus under corpus/media-modern/ exercises range syntax, hover/pointer pairs, prefers-contrast, and color-gamut; verify script scripts/verify-media-modern.mjs compares computed styles against Chrome (passing the same MediaEnvironment inputs to both); a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-media-modern.mjs exits 0 — computed styles match Chrome for every range-syntax and feature fixture given identical MediaEnvironment inputs. Existing media-queries corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not fabricate device capabilities the renderer cannot know — hover/pointer/any-*/update must be inputs to MediaEnvironment with documented defaults (the caller states the device surface), never guessed.
- Do not implement interaction pseudos or behavior in this slice — media features only gate styles.
- Do not break the existing width/height/prefers-*/resolution surface (corpus/media-queries must stay green).
- Do not implement scripting, display-mode, or monochrome-beyond-current unless a fixture proves Chrome parity — keep the documented supported set and record the rest.
- Do not regress the @container range-syntax parser while sharing the range machinery with @media.
