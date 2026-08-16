---
wait_human_start: false
wait_human_merge: false
dependencies: [text-measure-remaining-gaps]
---

# Task: Task: Add calc()/min()/max()/clamp() value-function resolution across length contexts

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Grep confirms no calc()/min()/max()/clamp() support anywhere in src/ — css.ts resolves lengths but has no value-function resolver, so real CSS using calc in widths, insets, paddings, and grid minmax() silently mis-resolves (a root cause of the ~60% geometry parity figure against arbitrary input). Add one value-function resolver over the existing length/percentage machinery; css-tree is already a dependency for parsing. Depends on text-measure-remaining-gaps so the measure seam (measure.ts/skia.ts) settles first and this task can add corpus without conflicting with in-flight work.

## Requirements

- [ ] Parse and resolve calc(), min(), max(), clamp() in every length/percentage context the engine resolves: width/height, margins/padding, inset/offset properties, and grid track sizing (minmax()/fr interplay).
- [ ] One resolver routed through the single length-resolution authority; unit mixing (px + %, em, rem) per css-values-4; division/multiplication (which Chrome rejects in some positions) correctly rejected.
- [ ] New corpus (corpus/calc/) with calc-driven widths, insets, minmax() tracks, and nested value functions; layer-1/3 deltas within charter tolerances vs Chrome.
- [ ] check-charter green with calc rows (or covered by an existing row token).

## Verification

npm run build passes. A verify:calc script (wired into session-idle's *calc* case) exits 0 with sub-pixel deltas on the calc corpus. check-charter green.

## Prohibited Patterns

- Do not weaken charter tolerances to pass.
- Do not add per-property special cases — one resolver for all length/percentage contexts.
- Do not touch the canvas interface or the measure seam's behavior.
