---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: position: sticky (static-viewport placement)

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Verified empirically against the built engine: an element with position:sticky renders at its static position (src/layout/css.ts:1478-1485 only maps static/relative/absolute/fixed; sticky falls through to static). Sticky is spec-current and ubiquitous (sticky headers/navs). A static pixel-buffer renderer has no scrolling, so this slice implements sticky per css-position-3 §3.6 at scroll offset 0: the box stays in flow and is placed like relative within its containing block — which is exactly what Chrome paints at scroll 0. Scroll-dependent offset (the box only actually shifts when scrolled) is out of scope and documented.

## Requirements

- [ ] position: sticky computes to sticky (getComputedStyle string parity with Chrome) and lays the box out in-flow at its static position offset by its insets, matching Chrome's pixel output at scroll offset 0.
- [ ] A sticky element establishes a containing block for its absolutely-positioned descendants like a relative element does (css-position-3 §2.2).
- [ ] Sticky participates in normal flow (occupies space, does not overlap following content), so a nav with position:sticky keeps its height and pushes content down exactly as Chrome lays it out.
- [ ] The stacking/paint order for a sticky element matches Chrome (in-flow with z-index honoring like relative).
- [ ] Corpus under corpus/sticky/ exercises a sticky header, a sticky element inside a scroll container, and a sticky element with absolutely-positioned children; verify script scripts/verify-sticky.mjs compares rects, computed styles, and non-text paint against Chrome at scroll 0; a charter §11 row with a corpus token is added.
- [ ] A docs/ledgers note records that scroll-dependent sticky offset is out of scope for a static renderer.

## Verification

npm run build passes. node scripts/verify-sticky.mjs exits 0 — every sticky fixture's computed position string and rects match Chrome at scroll 0 within tolerance, and non-text screenshots are within the pixel band. Existing positioning corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement scroll-dependent offset computation — the renderer has no scroll position; the sticky box is placed per its in-flow position and inset resolution at scroll 0 (css-position-3 §3.6), which is Chrome's paint at scroll 0.
- Do not make sticky create a containing block for absolute descendants unless the element would per spec (sticky establishes one like relative does — match Chrome).
- Do not regress static/relative/absolute/fixed — existing positioning corpora must stay green.
- Do not claim scrolling/scroll-snap or scroll-linked behavior anywhere in this slice; document that scroll-dependent stickiness is out of scope in a ledger note.
