# Parity Ledger

Aggregate four-layer results against the target browser, corpus changes, and
the honest state of the Chrome-vs-engine comparison. Owning seam: the verify
harness (`scripts/verify-*.mjs`), the four-layer model and tolerances from the
charter (§2, §9, §10), and `tolerances.json`.

## Method

`npm run verify` (and each `npm run verify:*` script) renders every corpus
fixture with the engine and collects the same quantities from headless Chrome
151 (Playwright) as the oracle:

- layer-1 `measureText` — shaped advance per string (engine Canvas interface vs
  Chrome `ctx.measureText`), mean ≤ 0.01px, no string > 0.5px.
- layer-2 `computedStyle` — exact string equality on the fixture's props.
- layer-3 `rect` — `getBoundingClientRect` per box, ≤ 0.5px per dimension.
- layer-4 `screenshot` — per-pixel ΔE ≤ 2, ≤ 1% of pixels exceeding for
  non-text pixels; text pixels compared under the tiered text-region tolerance
  (`tolerances.json` v2 — see `text-mask.md`).

All numbers below are from a fresh run on `main`
(2026-08-14, node 26.7.0 / icu 78.3, Chrome 151.0.7922.34, Playwright).

## Latest Run

### Four-Layer Spine Fixtures

| Fixture | measureText | computedStyle | rect | screenshot |
| --- | --- | --- | --- | --- |
| basic-text | PASS mean Δ 0.0012px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| boxes | PASS mean Δ 0.0005px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| inline-styles | PASS mean Δ 0.0028px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| replaced-boxes | PASS mean Δ 0.0040px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| wrapping | PASS mean Δ 0.0020px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |

Pretext seam (break-point parity vs Chrome line fragments): PASS, means
0.0000–0.0123px, max ≤ 0.0219px (charter §3 seam exercised per fixture).

### Other Verifiers

| Verifier | Result | Detail |
| --- | --- | --- |
| `verify:text-measure` | PASS 100.0% (82/82) | pass-corpus mean Δ 0.0016px, worst 0.0050px; 7 documented gaps |
| `verify:segmenter` | PASS 72/72 | grapheme + Pretext layout parity, node icu 78.3 vs chrome |
| `verify:media-queries` | PASS | reduced-motion 2/2, resolution 2/4, viewport-units 2/14, width-breakpoint 3/9 |
| `verify:firefox` | PASS | screenshot 0 exceeding; Pretext seam Δ 0.0000px |
| `verify:inline-block` | PASS 4/4 | rect max Δ 0.029px, screenshot ≤ 0.66% exceeding (badge backgrounds compared strictly, text under the tier) |
| `verify:layout-{flexbox,grid,floats,positioning}`, `verify:paint-text`, `verify:report` | PASS | rect max Δ 0.0000px, screenshot 0 exceeding everywhere |

`check-charter`: PASS — charter ratified, runtime within pin.

## Known Gaps (typed, trend toward zero)

Three fixtures currently declare a typed `expected.<layer>: { result:'fail',
reason, sunset }` gap (single per-layer form per improvement-plan §4). Every gap
carries its owner (reason) and expiry (sunset) as data in the fixture; the
verify scripts assert each still diverges, so a declaration can only move toward
zero by closing (flipping to `pass`) — never by silent removal. Current count: 3
declarations (7 entry-level known-gap strings inside `known-gaps`).

| Fixture | Layer | Reason (summary) | Sunset |
| --- | --- | --- | --- |
| `measure-corpus/known-gaps` | measureText | skia vs Chrome fontconfig fallback: emoji smileys, proportional tabs, mixed-script runs, Thai, Arabic punctuation/letter-spacing (7 entries; per-string deltas in `text-measure.md`) | reclassify each entry to pass when skia fallback matches Chrome's per-glyph fallback / tab-stop semantics |
| `media-queries/container-gap` | computedStyle | engine parses `@container` but layout never applies it (no container sizing); Chrome resolves the 400px container and paints `#child` red (see `media-queries.md`) | when layout resolves container sizes (`container-type`/`container-name` plumbing lands) |
| `harness-tolerances/regression-divergence` | screenshot | deliberate 48x24px divergence proving the screenshot gate fails as designed (regression self-test, not an engine gap) | permanent — retire only when the screenshot layer gains a fixture-free divergence-injection check |

Gap count over runs: 3 (as of 2026-08-14) before the coverage-matrix-sweep
task added the sweep corpus. The sweep (`corpus/sweep-*`) deliberately records
its engine divergences as typed gap fixtures; the two flexbox fixes —
fontmetrics baseline authority and wrap-reverse cross-axis ordering/stretch —
were complementary and together closed every sweep gap: **0 of 110 swept
combos still diverge** (see `docs/ledgers/sweep.md` for the per-combo deltas).
Each reduction requires closing the divergence the declaration documents; the
fixtures assert the divergence still exists, so a stale or removed declaration
fails `npm run verify`.

## Honest Reading (what the green run does and does not prove)

The headline numbers are real but incomplete. The following limit the claims
the green run supports, in order of impact.

### 1. Text pixels are compared under a tiered tolerance, not a blanket mask

The four-layer diff previously masked every text-fragment pixel
(`scripts/verify-four-layer.mjs`), so the observed `0.0000` worst/mean ΔE was
over **non-text pixels only**. That changed with `text-mask-parity`: the probe
(`scripts/probe-text-mask.mjs`) rendered the spine text fixtures unmasked and
found the two Skia instances (Chrome's compositor vs `@napi-rs/canvas`) are
**structurally divergent** on text — different font hinting/AA — with 60–74% of
glyph-interior (core-ink) pixels exceeding ΔE 2 even though Chrome's *own
canvas* `fillText` is 73% divergent from its own DOM-text screenshot. So text
is not excluded any more: it is compared under a documented tiered
text-region tolerance (`tolerances.json` v2, `docs/ledgers/text-mask.md`), and
every fixture reports its text-region pixels compared, mean/worst ΔE, and
text-pixel mask share (0 by default — only declared `maskRects`/`maskElements`
such as the `<img>` broken-image icon stay masked). The charter §10 band claim
is scoped to non-text pixels; the text tier's within-region exceed allowance
(97%) is the measured rasterizer gap. Caveat: the per-corpus verifiers
(`verify:paint-text`, `verify:layout-{floats,grid,flexbox,positioning}`,
`verify:firefox`) still blanket-mask text — porting the tier is follow-up.

### 2. The layer-1 seam mean tolerance is informational, not enforced

`verify-four-layer.mjs` gates the Pretext seam on `maxPx ≤ 0.5px` only; the
charter's `< 0.01px` mean is computed and reported but never checked. Example
of why this matters: `basic-text`'s seam mean is 0.0117px — over the 0.01px
band — yet the run is green. `verify:text-measure` likewise reports pass-corpus
mean 0.0016px without failing on a per-category mean breach.

### 3. Pretext is a test seam, not the engine's text layout

The engine's actual line/word wrapping is a hand-rolled greedy wrapper in
`src/layout/measure.ts`; `@chenglou/pretext` prepare/layout runs only inside
the verify harness over the Canvas interface. Break-point parity with Chrome
is proven **for the seam**, not for the shipped layout path.

### 4. Seven text-measure gaps remain, all diverging

Font-fallback cases where skia's resolution disagrees with Chrome's fontconfig
fallback (Noto Sans emoji/smiley, mixed-script runs, Thai, proportional tabs,
Arabic letter-spacing). Documented in `text-measure.md`; worst Δ 146.0px. All
single-script, single-face strings agree to ≤ 0.0050px.

### 5. Flexbox baselines are hard-coded, and the Firefox zeros are tautological — resolved

Three baseline formulas existed (block-inline, flexbox's hard-coded Noto
fractions `1069/1000`/`293/1000`, paint via fontmetrics). Flexbox ignored the
active browser config, so under `firefoxConfig` its baselines were wrong by
construction; the Firefox seam's Δ 0.0000px compared the engine against its own
constants, not a browser-derived measurement. That is fixed: one baseline
authority lives in `fontmetrics.ts` (`roundedAscent`/`roundedDescent`/
`lineAscentContribution` from the active face's parsed metrics — TTF and OTF),
and flexbox, block-inline and paint all resolve through it. Flexbox
`align-items:baseline`/line-baseline now derives from the active
browser-config's registered face, so under `firefoxConfig` it measures Source
Code Pro's real ascent/descent rather than Noto constants. The six
`flex-nowrap-*-baseline` sweep fixtures flipped 36 → 30 gap count.

### 6. The hardening task was archived without being executed

`archive/hardening-core/` was created (priority high) to close findings 1, 2,
3, 5 and the cross-module duplication, but was archived with no code changes —
all ten requirements remain open. This ledger is the live record of the state
that task was meant to fix.

## Cross-Browser Probe (Chrome vs Firefox, no engine)

`npm run probe:browser-gap` renders identical HTML in Playwright Chrome and
Playwright Firefox and diffs all four layers directly (no engine in the loop;
pure logic in `probes/lib/probe-gap-lib.mjs`, covered by `npm run test:probe`).

Read of the first run (5 fixtures): **layout is byte-identical across
browsers** — rect max Δ 0.0000px on every fixture, computedStyle 0 mismatches.
Text width differs sub-pixel (mean Δ 0.001–0.10px; the `Courier New` fallback
fixture is the one real measurement divergence at 0.10px). Text *rasterization*
diverges structurally (6.7–22% of text pixels over the ΔE≤2 text tier), which
is a pixel-level gap no font table can close.

Implication: the browser-config/fallback mechanism matters only for font
*resolution*, not for measurement or layout — Chrome and Firefox already agree
there. Feeding the correct per-browser canvas to Pretext stays the right
architecture for the Firefox/Safari track.

## Cross-Browser Probe (three browsers + the safari seam)

`probe:browser-gap` now attempts **Chrome, Firefox and Safari (Playwright
WebKit)** and reports per-pair deltas (measureText, computedStyle, rect, line
fragments, screenshot) for every pair among the browsers that launch, over 8
fixtures — the original 5 plus three safari-track fixtures
(`safari-courier-new`, `safari-monospace-generic`, `safari-serif-generic`)
authored to families the chrome and safari fallback tables resolve to the same
registered faces.

On this host the WebKit oracle cannot launch: Playwright's WebKit build requires
glibc ≥ 2.35–2.38 (Ubuntu 24.04 arm64) while Oracle Linux 9 ships glibc 2.34, so
`safari (WebKit) not available` is reported and its pairs skipped (charter §8
parks Safari on a provisioned platform). The probe still runs the **safari**
browser-config seam on every flat-text fixture, feeding each element's real
computed font-family through Pretext over the Canvas interface (the safari
canvas pressed in per `renderHtml`) and diffing seam line widths against
Chrome's fragments within the layer-1 max band — the WebKit-free reference,
since chrome and safari resolve the probe families identically. The safari seam
passes every fixture (mean Δ 0.008–0.015px, the Pretext width-reporting
rounding from Honest Reading #2; max Δ ≤ 0.024px). The seam's *resolution*
authority — that a fallback family's seam measurement equals the resolved
face's within the layer-1 mean tolerance (≤ 0.01px) — is asserted by the
probe's test suite and by the firefox fallback seam at 0.0000px
(`verify:firefox`). Details: `docs/ledgers/safari.md`.

## Firefox/Safari support task

`browser-canvas-support` shipped the browser-config seam through the engine and
Pretext:

- **One font-resolution authority** — the Pretext measurement context resolves
  the CSS family through the active `BrowserConfig` (`resolveFontFamily`)
  before hitting the Canvas (`src/pretext/index.ts`), identical to the engine's
  `cssFontString`; the seam and the engine measure the same per-browser faces.
- **Real families through the seam** — `verify-firefox.mjs` and
  `verify-four-layer.mjs` harvest each element's computed font-family and pass
  it to the seam instead of the hard-coded default family.
- **Firefox exercised end-to-end** — the seam on `fallback-courier-new`
  resolves `Courier New` through the firefox fallback table to Source Code Pro
  and matches Firefox's line fragments at mean Δ 0.0000px (layer-1 mean gate,
  ≤ 0.01px).
- **Safari config to the extent of glyph resolution** — `src/config/safari.ts`
  registers the faces WebKit resolves and carries a fallback table; the safari
  canvas is pressed into Pretext (see `safari.md`). The WebKit oracle itself
  stays parked pending platform provision (glibc limitation above).

## Performance: Engine vs Playwright Oracle

Generated by `npm run bench:engine-vs-oracle` (scripts/bench-engine-vs-oracle.mjs) on
2026-08-16 — node v26.7.0, Chrome via Playwright, Noto Sans (/usr/share/fonts/google-noto/NotoSans-Regular.ttf).

### Method: what each number is

- **Engine** — wall-clock of `renderHtml` (parse → cascade → layout → paint → RGBA
  buffer) in this Node process. `Cold` = first timed call for the fixture; `warm` =
  mean over 10 calls after one warmup. The engine is in-process, so the
  cold/warm axis that physically exists is the browser process; the engine columns are
  reported per temperature for the ratio table.
- **Chrome render** — Chrome's own render cost to first paint for the same HTML,
  measured *inside the page*: a `PerformanceObserver` (paint) installed via
  `addInitScript` records first-contentful-paint on a `data:` URL navigation of the
  fixture HTML. Not harness wall-clock; excludes page setup and screenshot.
  (`page.setContent`, which the verify harness uses, fires no paint timing entries —
  verified empirically — so the render measurement navigates the same HTML instead.)
- **Harness** — the full Playwright oracle path exactly as `verify-four-layer.mjs`
  does it, wall-clock: `newPage` → `setContent` → `document.fonts.ready` →
  per-quantity `evaluate` round-trips (rects, measureText, computedStyle, fragments) →
  screenshot → `close`.
- **Batched** — the same oracle path but every quantity collected in a single
  `evaluate` per fixture; **rt Δ** = harness − batched = the per-quantity round-trip
  cost.
- Ratios are time-taken multiples: `engine:CRO` = engine ÷ Chrome render (lower than
  1 = the engine paints faster than Chrome's own render), `harness:CRO` = harness ÷
  Chrome render (the harness wall-clock multiple over Chrome's render work), `engine:harness` =
  engine ÷ harness (the engine's time share of the full oracle path).

### Cold run (fresh browser process per fixture, single shot)

| Fixture | Engine | Chrome render | Harness | Batched | rt Δ (ms) | engine:CRO | harness:CRO | engine:harness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| basic-text | 62.8 | 52.0 | 392.7 | 240.7 | 152.1 | 1.21 | 7.55 | 0.16 |
| boxes | 10.9 | 40.0 | 293.8 | 225.3 | 68.5 | 0.27 | 7.35 | 0.04 |
| inline-styles | 21.1 | 52.0 | 438.7 | 245.2 | 193.5 | 0.41 | 8.44 | 0.05 |
| replaced-boxes | 11.3 | 60.0 | 463.7 | 207.0 | 256.7 | 0.19 | 7.73 | 0.02 |
| wrapping | 18.0 | 40.0 | 306.9 | 214.5 | 92.4 | 0.45 | 7.67 | 0.06 |
| **Sum (all spine)** | 124.1 | 244.0 | 1895.8 | 1132.7 | 763.1 | 0.51 | 7.77 | 0.07 |

### Warm run (browser pre-launched and warmed, as the verify scripts run; means of 3)

| Fixture | Engine | Chrome render | Harness | Batched | rt Δ (ms) | engine:CRO | harness:CRO | engine:harness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| basic-text | 22.3 | 46.7 | 254.5 | 190.4 | 64.1 | 0.48 | 5.45 | 0.09 |
| boxes | 12.0 | 42.7 | 262.5 | 183.8 | 78.7 | 0.28 | 6.15 | 0.05 |
| inline-styles | 14.7 | 40.0 | 323.9 | 184.9 | 139.0 | 0.37 | 8.10 | 0.05 |
| replaced-boxes | 15.1 | 53.3 | 300.9 | 213.2 | 87.7 | 0.28 | 5.64 | 0.05 |
| wrapping | 20.1 | 61.3 | 271.2 | 193.5 | 77.7 | 0.33 | 4.42 | 0.07 |
| **Sum (all spine)** | 84.2 | 244.0 | 1413.0 | 965.8 | 447.2 | 0.34 | 5.79 | 0.06 |

### Reading

- **The engine is faster than Chrome's own render work.** On the sums the engine takes
  51% of Chrome's render-to-FCP time cold (34% warm);
  on the warm run — the one that mirrors the verify harness — the per-fixture
  engine:CRO range is 0.28–0.48, i.e. the
  engine is ~2.1–3.6x faster per
  fixture than Chrome's own render. The lone cold outlier is basic-text at
  1.21, the process's first `renderHtml` call, which pays one-time
  font/measure-canvas init; it is not a representative render. The render work itself is
  genuinely where the engine wins, and it is not a timing artifact.
- **Most of the old "28x" was the harness, not Chrome.** The full oracle path is
  7.8x (cold) / 5.8x (warm) Chrome's actual render
  cost; 83% of the warm harness wall-clock is
  harness overhead (page setup, evaluate round-trips, screenshot), not Chrome rendering.
  The engine's honest multiple over the whole harness path is ~15.3x
  (cold) / ~16.8x (warm) — far below the earlier ~28x that billed
  Chrome's render plus harness overhead against the engine.
- **Per-quantity round-trips are a measurable, recoverable chunk.** Batching all oracle
  quantities into one `evaluate` per fixture cuts the oracle path by 32%
  (rt Δ sum 447ms warm), confirming
  the suspicion the old table recorded.
- **Cold vs warm.** Cold Chrome launch costs ~215ms; the cold
  oracle path is 1.34× the warm path (1896ms
  vs 1413ms summed), so browser warmth is the only material
  temperature axis and the engine (in-process) is unaffected.

Takeaway: time-wise the solution is genuinely more efficient than *Chrome rendering the
same HTML* (the render work is where the win lives), and the earlier headline ratio
mostly exaggerated because it charged the verification harness's round-trips, page
setup and screenshot against the engine's pure render.

## Corpus

- Spine: `corpus/spine/` — basic-text, boxes, inline-styles, replaced-boxes,
  wrapping (all four-layer).
- Measure: `corpus/measure-corpus/` — 89 strings across 8 categories.
- Segmentation: `corpus/segmenter/` — 72 strings, 5 categories.

## Divergences

The substantive divergences are items 1–6 above and the seven gaps in
`text-measure.md`. The one tolerance change is the text-region tier
(`tolerances.json` v2), recorded in `tolerances.md` and `text-mask.md`.
