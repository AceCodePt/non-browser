---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: unicode-bidi property and the bdo element

## Metadata

- **Complexity:** Low
- **Priority:** Low
- **Status:** Ready for Handoff

## Context

The engine resolves direction at the box level (css.ts direction, dir attribute presentational hint, logical margins/insets/float/text-align) but has no unicode-bidi property and no bdo element handling. bdo is spec-current (bidi-override for its content). Full Unicode BiDi Algorithm reordering within inline runs is a large separate feature; this slice lands the computed unicode-bidi surface and the bdo element so that direction override and inline alignment behave correctly, and honestly documents how far the reordering goes.

## Requirements

- [ ] unicode-bidi computes per css-writing-modes-4 §3.1 for the current value set (normal, isolate, bidi-override, isolate-override, plaintext) with getComputedStyle parity.
- [ ] The bdo element gets the UA default unicode-bidi: bidi-override and honors its dir attribute, so bdo content renders with the specified direction and its inline alignment (text-align start/end) resolves per that direction, matching Chrome.
- [ ] unicode-bidi: bidi-override on an element forces its inline content's direction to the element's direction, affecting inline-start alignment of its lines.
- [ ] The isolation values (isolate, isolate-override, plaintext) are computed and, to the extent the engine's inline layout models them, behave like Chrome; any reordering behavior not implemented is recorded as a declared divergence in the ledger, not silently claimed.
- [ ] Corpus under corpus/unicode-bidi/ exercises bdo with dir=rtl/ltr, a bidi-override span, and an isolate span; verify script scripts/verify-unicode-bidi.mjs compares computed styles, rects, and non-text paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-unicode-bidi.mjs exits 0 — computed unicode-bidi/direction strings match Chrome exactly and the bdo/override fixtures' rects and non-text paint are within tolerance. corpus/rtl-layout stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not claim full UBA (Unicode BiDi Algorithm) visual reordering of mixed-direction runs unless implemented and gated by a corpus fixture — record the reordering boundary in the ledger.
- Do not change the existing direction/computed logical-mapping behavior (corpus/rtl-layout must stay green).
- Do not implement legacy unicode-bidi values that modern CSS has removed (embed/override in some contexts are deprecated in css-writing-modes-4 §3.1 — follow the current spec's value set: normal, isolate, bidi-override, isolate-override, plaintext).
- Do not regress text-align start/end resolution which already consults direction.
