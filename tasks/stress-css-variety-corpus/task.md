---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Task: Stress CSS-variety corpus — many small high-variety fixtures + one big all-variety page, at small resolutions

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The corpus is currently feature-isolated small fixtures — the largest is ~3KB HTML (flexbox align-content) and there is no page-scale, many-component, multi-viewport, or low-resolution stress test. That isolation is great for finding per-feature bugs but cannot surface cross-feature interactions (deep nesting, many siblings, flex+grid mix, stacking context, shadows+opacity+borders+text together) and gives no signal on how the engine holds parity on a real-scale page or at a mobile/low viewport. The charter targets browser parity for arbitrary HTML/CSS (charter §5, incl. shast renderComponent output), so a variety/stress corpus is the honest test of that claim. Design per the owner: (1) several SMALL fixtures each packing a lot of CSS-property variety, plus (2) ONE BIG fixture combining ALL the variety, all rendered across low/small resolutions in addition to a desktop viewport, the entire point being to hit as many CSS attributes as possible. Independent of container-query-layout and css-property-coverage-audit (different files/corpora; this task's big page will naturally exercise the property-coverage audit's recognized set).

## Requirements

- [ ] New corpus/stress/ with a set of SMALL fixtures, each packing a lot of CSS-property variety: e.g. a card grid (flex+grid+gap+border-radius+shadow+background), a form (border/padding/margin/display:block/inline-block/labels+inputs at small widths), a text-heavy article (white-space normal/nowrap/pre, text-align, letter-spacing, list-style, ::before/::after), a nav bar (flex justify/align, nested lists, z-index/stacking), and an RTL/LTR mixed section — each rendered at a small resolution (e.g. 360x640) and one desktop viewport, full four-layer parity vs Chrome.
- [ ] One BIG fixture (corpus/stress/kitchen-sink/ or similar) that combines ALL the variety from the small fixtures into a single large HTML page — tens of components, deep nesting, flex+grid mix, shadows, opacity, borders, border-radius, calc() widths, text runs, RTL, lists, pseudo-elements, media-query-dependent blocks — rendered at multiple resolutions including small (e.g. 320x568, 360x640) and desktop, full four-layer parity.
- [ ] scripts/verify-stress.mjs renders the stress corpus engine-vs-Chrome and asserts the four-layer tolerances (charter §2): measureText sub-pixel, computedStyle exact, rect ≤0.5px, non-text screenshot ≤1% exceeding; a divergence must be fixed or declared as a typed gap.
- [ ] Wire the session-idle *stress* case to run npm run build && node scripts/verify-stress.mjs (positive gate — the script must exist).
- [ ] check-charter green: the coverage matrix reflects the stress corpus exercising the claimed properties; the css-property-coverage audit (separate task) cross-references the attributes the stress fixtures exercise.

## Verification

npm run build passes. node scripts/verify-stress.mjs exits 0 (the session-idle *stress* gate runs it): every small fixture and the big kitchen-sink page report four-layer parity vs Chrome at their declared viewports, including the small resolutions. Any divergence is a declared typed gap in docs/ledgers/parity.md or fixed. check-charter green.

## Prohibited Patterns

- Do not weaken the four-layer tolerances to make page-scale fixtures pass — parity is the point; a divergence must be fixed or recorded as a typed gap, not tolerated.
- Do not author fixtures that only assert pass without exercising real attributes — each small fixture must pack genuine CSS-property variety.
- Do not skip the low-resolution viewport passes — small resolutions are an explicit goal.
- Do not add a fixture that relies on a property the css-property-coverage audit reports as ignored (e.g. transform) unless that property is implemented or the fixture is a declared gap.
