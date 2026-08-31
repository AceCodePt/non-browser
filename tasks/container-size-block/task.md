---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: @container size/block-size containment and container query units

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The charter and README declare @container size/block-size containment deferred (charter §11: "full size and block-size containment values parse but establish no container in v1"). Only inline-size containers are queryable today. This slice lands full two-axis containment: container-type: size and block-size establish queryable containers, @container conditions can query width/height (and block-size/inline-size), and container query units (cqw/cqh/cqi/cqb/cqmin/cqmax) resolve against the nearest container. It closes the declared deferred surface and is spec-current (css-contain-3).

## Requirements

- [ ] container-type: size and block-size establish query containers (block-size queries the inline axis; size queries both axes), so @container (min-width: ...)/(min-height: ...)/(block-size: ...)/(inline-size: ...) conditions match like Chrome.
- [ ] Container query units cqw/cqh/cqi/cqb/cqmin/cqmax parse as lengths and resolve against the nearest matching ancestor container's content-box size per css-contain-3 §7, with computed-style serialization parity.
- [ ] Elements with container-type: size establish both axes for descendants without circular sizing (extending the existing convergeLayout fixed-point iteration in src/layout/render.ts).
- [ ] The charter/README claim 'size/block-size containment deferred' is amended to implemented with a corpus token.
- [ ] Corpus under corpus/container-size/ exercises a size container querying both axes, a block-size container, a named container with container units, and a non-matching case; verify script scripts/verify-container-size.mjs compares computed styles, rects, and paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-container-size.mjs exits 0 — computed styles, rects, and non-text paint match Chrome for every fixture. Existing media-queries corpus (including the inline-size container fixtures) stays green. node scripts/check-charter.mjs exits 0 with the deferred claim amended.

## Prohibited Patterns

- Do not weaken the existing inline-size container behavior (corpus/media-queries must stay green) while adding size/block-size.
- Do not make container-type: size establish a container before its own size is resolvable — a size container's query size is its content-box, which must be computed before descendants query it (the fixed-point iteration in render.ts already exists — extend it, don't fork it).
- Do not implement container query units (cqw/cqh/cqi/cqb/cqmin/cqmax) without a fixture proving they resolve against the nearest ancestor container per css-contain-3 §7.
- Do not regress the container-name chain matching (named containers and unnamed nearest).
- Do not claim scrollport/scroll-state container features — out of scope.
