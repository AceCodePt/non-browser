---
wait_human_start: false
wait_human_merge: false
dependencies: [paint-run-fallback]
---

# Task: Task: box-shadow and text-shadow parsing + paint on the canvas seam (redo of the archived box-shadow-paint)

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

archive/box-shadow-paint/ was archived empty — no box-shadow or text-shadow parsing or paint exists in src (grep: zero hits), so cards, buttons, and popovers diverge at layer 4 (the archived spec's own rationale). The 95%-parity push listed it as very common. This redo adds shadow parsing + paint on the skia canvas, matching Chrome's offset, blur, spread, and color. Depends on paint-run-fallback so both edits to src/canvas/skia.ts + interface.ts serialize.

## Requirements

- [ ] Parse box-shadow and text-shadow into ComputedStyle (offset, blur, spread, color, inset, multiple shadows) per css-backgrounds-3 / css-text-decor-3.
- [ ] Paint shadows through the Canvas interface primitives, matching Chrome's shadow placement per layer-4 non-text tolerance.
- [ ] New corpus (corpus/box-shadow/) with cards, buttons, inset, multiple, and colored shadows; text-shadow fixtures over the text pipeline.
- [ ] check-charter green with shadow rows (or coverage via an existing token).

## Verification

npm run build passes. A verify:shadow script (wired into session-idle's *shadow* case) exits 0 with screenshot deltas within tolerance on the shadow corpus. check-charter green.

## Prohibited Patterns

- Do not weaken layer-4 tolerances (ΔE ≤ 2, ≤ 1% exceeding).
- Do not add skia-specific types to src/canvas/interface.ts.
- Do not regress border-radius or text paint.
