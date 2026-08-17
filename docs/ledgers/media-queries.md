# Media Queries Ledger

Owning module: `src/cascade/phases/media-queries.ts` (media/container query
parsing and evaluation against the viewport input, cascade gating, and viewport
units). Supporting modules: `src/cascade/media.ts` (media query grammar +
evaluation), `src/cascade/selector.ts` (type/id/class/compound/descendant/child
matching + specificity), `src/cascade/stylesheet.ts` (stylesheets into rules).
Corpus: `corpus/media-queries/`.

## Scope

A static renderer evaluates `@media` once per viewport input — deterministic,
no resize concerns. The media environment is the viewport input only
(width/height plus the feature inputs prefers-color-scheme,
prefers-reduced-motion, dppx); nothing is evaluated against a live browser
surface. The corpus verifies, against Chrome's `getComputedStyle` (layer-2,
exact equality), at multiple viewports per fixture:

- width/height features: `min-width`, `max-width`, exact `width`, and the same
  for height
- `aspect-ratio` and `min-`/`max-aspect-ratio` (exact rational comparison)
- `orientation` (portrait when height >= width)
- `prefers-color-scheme` and `prefers-reduced-motion` (driven by the viewport
  input; the Chrome oracle is emulated to the same preference)
- `resolution` (in x/dppx/dpi/dpcm; the oracle is driven through CDP device
  metrics, since this headless shell ignores Playwright's deviceScaleFactor)
- compound conditions with `and` / `or` / `not`, and comma-separated media
  query lists (OR across queries)
- rules inside a false query are excluded from the cascade; true queries
  contribute, ordered by specificity then source order (media-specificity)
- viewport units `vw` / `vh` / `vmin` / `vmax` resolve against the viewport
  input at computed-value time, in both stylesheet and inline declarations
- `@container` (inline-size scope): layout computes each inline-size container's
  content-box size, the cascade resolves each rule's nearest qualifying ancestor
  container (by name, when a name is given) and evaluates the condition against
  that size, then the engine iterates cascade↔layout to a fixed point — matching
  Chrome for min-/max-width, exact, and range-syntax width conditions.

## Corpus (14 fixtures)

| Fixture | Covers |
| --- | --- |
| `width-breakpoint` | min-/max-width gating, exact `(width: Npx)` |
| `compound-media` | `and`, `or`, `not` composition |
| `aspect-ratio` | exact and min-/max- ratio comparisons |
| `orientation` | portrait/landscape |
| `prefers-color-scheme` | dark/light feature |
| `prefers-reduced-motion` | reduce/no-preference feature |
| `resolution` | `(resolution: 1x)` and `(min-resolution: 2dppx)` |
| `viewport-units` | vw/vh/vmin/vmax in stylesheet + inline |
| `media-query-list` | comma-separated OR |
| `media-specificity` | specificity + source order inside a true query |
| `container-inert` | `@container` with no container established (both engines ignore) |
| `container-gap` | `@container` with an established container (was the documented divergence) |
| `nested-container` | nearest-container resolution across nested inline-size containers |
| `non-matching-container` | a container whose size fails the query, plus an uncontained element |

## @container (resolved divergence, inline-size scope)

The one declared resolution error now closes: layout computes container sizes,
so the cascade applies `@container` rules. `container-gap` was a typed-fail
fixture proving the engine never applied `@container` while layout provided no
container sizing; it now passes with exact computed-style equality against
Chrome (`#child` is `rgb(255, 0, 0)` at both harvest viewports).

How it works: an element establishes a query container when its
`container-type` is not `normal`. v1 implements `inline-size` (the content-box
width feeds size conditions, matching Chrome); `size` and `block-size` parse but
establish no container yet — documented scope, not silent. For each `@container`
rule, the engine walks up from the target element and selects the nearest
ancestor that establishes a container; a named query `@container sidebar (...)` 
selects the nearest ancestor whose `container-name` lists `sidebar` (skipping
non-matching nearer containers). The condition — min-/max-width, exact, range
syntax `width > 300px`, aspect-ratio, `and`/`or`/`not` — is evaluated against
that container's content-box size via `evaluateContainerCondition`. Because an
`@container` rule can itself change a container's size, the cascade↔layout loop
iterates to a fixed point on the container content-box sizes before reporting.

The contract proven by `container-inert` still holds: a size query with no
qualifying container never matches.

## Viewport input contract

`renderHtml(html, { width, height, media: { prefersColorScheme,
prefersReducedMotion, dppx } })` is the only entry point. The media-queries
phase reads the viewport and media options; layout resolves viewport units
against the same viewport. There is no resize path — the renderer is evaluated
once per viewport.

## Results

`npm run verify:media-queries` exits 0. All 14 fixtures pass all fixture x
viewport combinations with exact computed-style equality against Chrome,
including the flipped `container-gap` (previously the asserted `@container`
divergence). `reference.json` (Chrome) and `candidate.json` (engine) are written
per fixture; reports land in `docs/reports/media-queries/`.

## Divergences

None beyond the `@container` `size`/`block-size` scope above (parse but no
container in v1). Out of scope and not exercised by the corpus: @media in
`@import`ed sheets, `@supports`, range syntax inside @media (`(width > 300px)`
is @container-only here), custom properties, `!important`/layers (separate
cascade phase modules), and media queries whose feature the engine does not
parse (those rules parse-error and are dropped, matching a browser's recovery).
