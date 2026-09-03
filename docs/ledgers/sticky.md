# Sticky Ledger

Owning module: `src/layout/css.ts` (position: sticky computes to 'sticky'),
`src/layout/block-inline.ts` (the scroll-0 constraint pass in layoutBlock,
scrollport/clamp-rect threading through `LayoutBlockInput`). Corpus:
`corpus/sticky/`. Verification: `scripts/verify-sticky.mjs`
(`npm run verify:sticky`).

## Scope

- position: sticky computes to 'sticky' and lays out in-flow at its static
  position; the box occupies flow space (following siblings are not
  overlapped) and its insets shift the paint the way relative insets do.
- The shift is the css-position-3 §3.6 constraint pass at scroll offset 0:
  the box moves minimally so its rect satisfies the insets against the
  nearest scrollport (the padding box of the nearest scroll container, else
  the initial containing block), clamped to its containing block. All
  behaviors are probe-verified against Chrome at scroll 0 (top-driven shifts,
  bottom-driven holds, the containing-block clamp on both axes, scrollport
  resolution inside overflow containers with borders and padding).
- Sticky establishes a containing block for absolutely-positioned descendants
  (abs children anchor to the shifted border box) and stacks like any
  positioned box (z-index honored).
- Scroll containers are detected through the `overflow` shorthand; the
  engine's overflow model is single-axis (`overflow-x`/`overflow-y`
  declarations are not parsed — pre-existing behavior, documented in the
  header fixture note).

## Out of scope for a static renderer (explicit, not silent)

- **Scroll-dependent stickiness**: the renderer has no scroll position, so
  the box does not pin when the scrollport scrolls past it. Every paint is
  Chrome's paint at scroll offset 0.
- **Sticky inside auto-height scroll containers**: the scrollport height is
  only known when the container's height is definite; with an auto height the
  container's insets resolve against the viewport fallback.
- **Containing-block clamp under auto-height parents**: the vertical clamp
  needs the parent's final content height, unavailable mid-flow; the clamp is
  applied only when the parent's height is definite (horizontal clamp is
  always applied). Scroll-container parents never clamp vertically (their
  containing block extends over the full flowed content — probe-verified).
- **Sticky flex/grid items**: the constraint pass runs on the block path;
  flex/grid item layout does not apply sticky shifts.
