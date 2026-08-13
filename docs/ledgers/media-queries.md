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

## Corpus (12 fixtures)

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
| `container-gap` | `@container` with an established container (documented divergence) |

## @container gap (documented, not silently wrong)

`@container` needs `container-type`/`container-name` plumbing that layout
provides later. This task establishes the *evaluation model* — the phase parses
`@container` conditions (min-/max-width, exact, range syntax `width > 300px`,
aspect-ratio, `and`/`or`/`not`) and `evaluateContainerCondition(condition,
containerSize)` can evaluate them against a container's content-box size — but
layout does not yet compute container sizes, so the cascade **never applies**
`@container` rules.

Two corpus fixtures prove the state, so the gap is observable rather than
silent:

1. `container-inert` — no `container-type`/`container-name` anywhere in the
   document. Chrome's `@container (min-width: 100px)` evaluates to false
   (querying a size feature without a container) and does not apply; the engine
   also does not apply it. Computed styles match. This is the contract the
   engine must keep even once container sizing lands: a size query with no
   container must never match.

2. `container-gap` — a container IS established:

   ```html
   <style>
     body { margin: 0; }
     .wrap { container-type: inline-size; width: 400px; }
     @container (min-width: 100px) { #child { color: rgb(255, 0, 0); } }
   </style>
   <div class="wrap"><div id="child">Child</div></div>
   ```

   Chrome resolves the nearest container for `#child` to `.wrap`, whose
   content-box width is 400px, so `(min-width: 100px)` matches and `#child` is
   `rgb(255, 0, 0)`. The engine parses the same rule but cannot resolve a
   container size, so `#child` stays `rgb(0, 0, 0)`. The fixture declares
   `expected.computedStyle: 'fail'`, so the verify script passes **only while
   Chrome and the engine diverge exactly as described above** — the divergence
   is asserted, not papered over. When the container plumbing lands, this
   fixture flips to `pass` and the whole corpus exercises `@container` for real.

Concrete gap example that must also hold once implemented: with the above HTML
at a 600px viewport, `getComputedStyle(#child).color` is `rgb(255, 0, 0)` in
Chrome and `rgb(0, 0, 0)` in the engine today; a `@container (min-width: 401px)`
variant would NOT match (container is 400px), and an element with no matching
container must stay unaffected.

## Viewport input contract

`renderHtml(html, { width, height, media: { prefersColorScheme,
prefersReducedMotion, dppx } })` is the only entry point. The media-queries
phase reads the viewport and media options; layout resolves viewport units
against the same viewport. There is no resize path — the renderer is evaluated
once per viewport.

## Results

`npm run verify:media-queries` exits 0. All 12 fixtures pass all fixture x
viewport combinations with exact computed-style equality against Chrome; the
`container-gap` fixture passes by asserting its documented divergence.
`reference.json` (Chrome) and `candidate.json` (engine) are written per
fixture; reports land in `docs/reports/media-queries/`.

## Divergences

None beyond the documented `@container` gap above. Out of scope for this task
and not exercised by the corpus: @media in `@import`ed sheets, `@supports`,
range syntax inside @media (`(width > 300px)` is @container-only here), custom
properties, `!important`/layers (separate cascade phase modules), and media
queries whose feature the engine does not parse (those rules parse-error and
are dropped, matching a browser's recovery).
