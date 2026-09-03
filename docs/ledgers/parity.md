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

All four-layer spine fixture numbers below are the latest recorded run
(2026-08-14, node 26.7.0 / icu 78.3, Chrome 151.0.7922.34, Playwright); the
full `npm run verify` (now including `verify:stress`) re-ran green on
2026-08-17, exit 0, with the fresh four-layer and stress reports under
`docs/reports/`.

## Latest Run

### Four-Layer Spine Fixtures

| Fixture | measureText | computedStyle | rect | screenshot |
| --- | --- | --- | --- | --- |
| basic-text | PASS mean Δ 0.0012px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| boxes | PASS mean Δ 0.0005px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| inline-styles | PASS mean Δ 0.0028px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| replaced-boxes | PASS mean Δ 0.0040px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |
| wrapping | PASS mean Δ 0.0020px | PASS 0 mismatch | PASS max Δ 0.0000px | PASS 0 exceeding |

Engine breaker (break-point parity vs Chrome line fragments): PASS, max Δ
0.0000–0.0150px per line (the engine's own fragments, laid out through the
Pretext breaker — no separate seam call; layer-1 mean/max enforced on the
measureText strings).

### Other Verifiers

| Verifier | Result | Detail |
| --- | --- | --- |
| `verify:text-measure` | PASS 100.0% (96/96) | pass-corpus mean Δ 0.0025px, worst 0.0300px; 0 documented gaps (7 → 0) |
| `verify:segmenter` | PASS 72/72 | grapheme + Pretext layout parity, node icu 78.3 vs chrome |
| `verify:media-queries` | PASS | reduced-motion 2/2, resolution 2/4, viewport-units 2/14, width-breakpoint 3/9 |
| `verify:firefox` | PASS | screenshot 0 exceeding; engine breaker (through Pretext) max Δ 0.0000px per line |
| `verify:inline-block` | PASS 4/4 | rect max Δ 0.029px, screenshot ≤ 0.66% exceeding (badge backgrounds compared strictly, text under the tier) |
| `verify:layout-{flexbox,grid,floats,positioning}`, `verify:paint-text`, `verify:firefox`, `verify:report` | PASS | rect max Δ 0.0000px, non-text screenshot 0 exceeding everywhere; text compared under the tier (0 exceeding on non-text, text under `layers.screenshot.text`) |

`check-charter`: PASS — charter ratified, runtime within pin.

## Stress corpus (page-scale, multi-viewport)

`corpus/stress` adds the page-scale gate the feature-isolated fixtures cannot
cover (all four layers vs Chrome, no typed gaps — every fixture passes):

- five small high-variety fixtures at 360x640 + 1280x800: `card-grid` (grid
  tracks + flex-column cards + gap + border-radius + box-shadow), `form`
  (labels + explicit-height styled inputs + submit), `article` (white-space
  normal/nowrap/pre, text-align, whole-block letter-spacing, list-style,
  ::before, a default-indented list), `navbar` (position:fixed flex bar,
  z-index stacking, nested dropdown list), `rtl-mix` (per-element direction,
  logical margins, RTL flex).
- one `kitchen-sink` page combining all the above at 320x568, 360x640, and
  1280x800 (deep nesting, flex+grid mix, opacity, borders, border-radius,
  calc(), pseudo-elements, media queries, propagated body background).
- `npm run verify:stress` (`scripts/verify-stress.mjs`) drives it; the
  session-idle `*stress*` gate runs build + verify-stress + check-charter.
  Runtime (fresh, node 26.7.0): 13/13 fixtures pass in ~37s wall-clock
  (~10s user, ~308 MB peak RSS) across 13 page renders (6 small viewports +
  3 kitchen-sink viewports) against live headless Chrome — the page-scale gate
  pays one Playwright page and one engine render per viewport.

Authoring it surfaced and closed real cross-feature engine bugs, all fixed in
place (no new typed gaps): the auto grid-track measurement ignored a flex/grid
child's row-gap; grid item placement dropped the container's top padding
(`contentY`); the body background did not propagate to the canvas
(css-backgrounds-3 §2.11.1); per-side `border-<side>` and the `list-style`
shorthands were unparsed; a row flex container's intrinsic width took the max
of its items instead of the sum + gaps (css-flexbox-1 §9.4), and absolutely
positioned children leaked into a parent's intrinsic size. Each is recorded in
the fix history on this branch.

## Known Gaps (typed, trend toward zero)

Two fixtures currently declare a typed `expected.<layer>: { result:'fail',
reason, sunset }` gap (single per-layer form per improvement-plan §4). Every gap
carries its owner (reason) and expiry (sunset) as data in the fixture; the
verify scripts assert each still diverges, so a declaration can only move toward
zero by closing (flipping to `pass`) — never by silent removal. Current count: 2
declarations (`measure-corpus/known-gaps` retired once its last two entries —
proportional-font tabs and Arabic joining-script letter-spacing — were
reclassified into the pass corpus, closing 7 → 0).

| Fixture | Layer | Reason (summary) | Sunset |
| --- | --- | --- | --- |
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
(97%) is the measured rasterizer gap. Every per-corpus verifier
(`verify:paint-text`, `verify:layout-{floats,grid,flexbox,positioning}`,
`verify:firefox`, `verify:inline-block`) now compares text under the same tier
— each fixture reports its text-region pixels compared, mean/worst ΔE, and
text-pixel mask share (0 by default — only declared masks stay masked).

### 2. The layer-1 mean tolerance is enforced — resolved when the seam call was retired

`verify-four-layer.mjs` enforces the charter layer-1 mean on the measureText
strings (`evaluate.ts`: `meanDelta <= meanPx && maxDelta <= maxPx`), and the
engine's own line fragments are gated on the layer-3 rect band. The earlier
owned overage (`basic-text` mean 0.0117px, `wrapping` mean 0.0123px) belonged
to the standalone Pretext-seam call, which measured Pretext's internally
rounded line widths against Chrome's fragments; `pretext-breaker-path` removed
that call — the engine path is the one under test (the engine breaks text
through Pretext and its fragments are measured with the engine's own canvas) —
so `verify:four-layer` is green again. `verify:text-measure` enforces the same
mean (pass-corpus mean 0.0025px).

### 3. The engine's text layout is the Pretext breaker

The engine's shipped line/word wrapper is `@chenglou/pretext` over the Canvas
interface: `layoutTextLines` feeds the wrapping modes through `breakNextLine`
(`src/layout/measure.ts`), and the pure-text block path delegates to it
(`src/layout/block-inline.ts`). The greedy space-break wrapper survives only as
the `CASCADE_BREAKER=greedy` fallback, which the drift gate (`verify:breaker`)
proves agrees with Pretext on the spine. The inline-piece walker still owns
mixed inline content (atomics, foreign-style spans) and `justify` lines — the
per-run styling Pretext's plain-string model cannot carry — and the white-space
per-mode handling stays in `layoutTextLines` (see `docs/ledgers/breakers.md`).
Break-point parity with Chrome is proven **for the engine path**, which is the
shipped layout path.

### 4. Seven text-measure gaps remain, all diverging — resolved (7 → 0)

Font-fallback cases where skia's resolution disagreed with Chrome's fontconfig
fallback (Noto Sans emoji/smiley, mixed-script runs, Thai, proportional tabs,
Arabic punctuation/letter-spacing; worst Δ 146.0px). Closed through three
tasks: `font-registration-faces` (Thai + emoji faces registered),
`per-glyph-fallback` (script-run splitting at the measurement seam,
`src/canvas/script-fallback.ts`), and `text-measure-remaining-gaps`
(proportional-tab advance math in `src/canvas/tabs.ts`; joining-script
letter-spacing suppression in `src/layout/letter-spacing.ts`). All seven
entries were reclassified into the pass corpus; `corpus/measure-corpus/known-gaps`
is retired with 0 documented gaps (see `text-measure.md`; worst Δ now 0.0300px
across 96 pass strings).

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
all ten requirements remain open. Its successor is `coherence-generalize`,
which closed the cross-module duplication piece of that scope (single `clamp`
and `borderPaddingInline`/`borderPaddingBlock` authorities in `src/layout/css.ts`,
percentage lengths routed exclusively through `resolveLength`, parse5 node-type
guards shared from `src/layout/types.ts`, the 0.75em ascent fallback owned by
`fontmetrics.ts` via `fallbackAscent`, and the positioned-layout family
fallback routed through the active config). Findings 1–3 remain live as items
1–3 above; finding 5 is resolved (item 5).

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
2026-09-01 — node v26.8.1, Chrome via Playwright, Noto Sans (/usr/share/fonts/google-noto/NotoSans-Regular.ttf).

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
| basic-text | 38.8 | 80.0 | 916.8 | 118.0 | 798.7 | 0.48 | 11.46 | 0.04 |
| boxes | 7.3 | 20.0 | 162.9 | 151.0 | 11.9 | 0.36 | 8.14 | 0.04 |
| inline-styles | 10.5 | 32.0 | 180.3 | 92.3 | 88.0 | 0.33 | 5.64 | 0.06 |
| replaced-boxes | 7.1 | 28.0 | 197.3 | 101.0 | 96.3 | 0.25 | 7.04 | 0.04 |
| wrapping | 6.0 | 28.0 | 163.3 | 128.7 | 34.6 | 0.21 | 5.83 | 0.04 |
| **Sum (all spine)** | 69.7 | 188.0 | 1620.5 | 591.0 | 1029.5 | 0.37 | 8.62 | 0.04 |

### Warm run (browser pre-launched and warmed, as the verify scripts run; means of 3)

| Fixture | Engine | Chrome render | Harness | Batched | rt Δ (ms) | engine:CRO | harness:CRO | engine:harness |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| basic-text | 6.3 | 24.0 | 128.2 | 94.9 | 33.3 | 0.26 | 5.34 | 0.05 |
| boxes | 4.7 | 25.3 | 116.1 | 66.5 | 49.6 | 0.19 | 4.58 | 0.04 |
| inline-styles | 4.7 | 24.0 | 167.4 | 93.8 | 73.6 | 0.19 | 6.97 | 0.03 |
| replaced-boxes | 5.3 | 25.3 | 127.0 | 70.1 | 56.9 | 0.21 | 5.01 | 0.04 |
| wrapping | 4.7 | 24.0 | 136.4 | 81.2 | 55.2 | 0.20 | 5.68 | 0.03 |
| **Sum (all spine)** | 25.8 | 122.7 | 675.0 | 406.5 | 268.5 | 0.21 | 5.50 | 0.04 |

### Breaker before/after (performance guard)

Both breakers are timed on the engine side within the same run. **Before** =
the flagged greedy fallback (`CASCADE_BREAKER=greedy`, the pre-swap engine);
**after** = the shipped Pretext breaker (the default). Columns: engine warm ms
per breaker, the after-minus-before Δ, the percent over (negative = the Pretext
path is faster), and each breaker's engine:CRO ratio (engine ÷ Chrome
render-to-FCP; the lower the better). The recorded guard: the Pretext path's
summed warm engine time is 25.8ms vs 24.1ms for the
greedy fallback (+6.8%
over; engine:CRO 0.20 → 0.21) —
this is the documented, recorded regression bound, and the Pretext engine stays
faster than Chrome's own render.

| Fixture | Engine greedy ms | Engine pretext ms | Δ ms | % over | engine:CRO greedy | engine:CRO pretext |
| --- | --- | --- | --- | --- | --- | --- |
| basic-text | 5.4 | 6.3 | 0.9 | 16.4% | 0.23 | 0.26 |
| boxes | 4.9 | 4.7 | -0.2 | -3.6% | 0.19 | 0.19 |
| inline-styles | 4.2 | 4.7 | 0.5 | 11.5% | 0.17 | 0.19 |
| replaced-boxes | 5.1 | 5.3 | 0.2 | 3.5% | 0.20 | 0.21 |
| wrapping | 4.5 | 4.7 | 0.3 | 5.9% | 0.19 | 0.20 |
| **Sum (all spine)** | 24.1 | 25.8 | 1.6 | 6.8% | 0.20 | 0.21 |

### Reading

- **The engine is faster than Chrome's own render work.** On the sums the engine takes
  37% of Chrome's render-to-FCP time cold (21% warm);
  on the warm run — the one that mirrors the verify harness — the per-fixture
  engine:CRO range is 0.19–0.26, i.e. the
  engine is ~3.8–5.4x faster per
  fixture than Chrome's own render. The lone cold outlier is basic-text at
  0.48, the process's first `renderHtml` call, which pays one-time
  font/measure-canvas init; it is not a representative render. The render work itself is
  genuinely where the engine wins, and it is not a timing artifact.
- **Most of the old "28x" was the harness, not Chrome.** The full oracle path is
  8.6x (cold) / 5.5x (warm) Chrome's actual render
  cost; 82% of the warm harness wall-clock is
  harness overhead (page setup, evaluate round-trips, screenshot), not Chrome rendering.
  The engine's honest multiple over the whole harness path is ~23.3x
  (cold) / ~26.2x (warm) — far below the earlier ~28x that billed
  Chrome's render plus harness overhead against the engine.
- **Per-quantity round-trips are a measurable, recoverable chunk.** Batching all oracle
  quantities into one `evaluate` per fixture cuts the oracle path by 40%
  (rt Δ sum 269ms warm), confirming
  the suspicion the old table recorded.
- **Cold vs warm.** Cold Chrome launch costs ~519ms; the cold
  oracle path is 2.40× the warm path (1621ms
  vs 675ms summed), so browser warmth is the only material
  temperature axis and the engine (in-process) is unaffected.

Takeaway: time-wise the solution is genuinely more efficient than *Chrome rendering the
same HTML* (the render work is where the win lives), and the earlier headline ratio
mostly exaggerated because it charged the verification harness's round-trips, page
setup and screenshot against the engine's pure render.

## Paint-stage perf: the raw-RGBA fast path and the paint-perf gate

Task `paint-path-perf` closed the last renderHtml bottleneck. After
`measure-fastpath-cache` the paint stage dominated `renderHtml` (paint marginal
47–64ms at desktop viewports, 11–23ms at mobile), leaving the engine ~2.0–2.4x
behind Chrome FCP on the page-scale fixtures.

### The choice: raw-RGBA fast path, not a cheaper/lazier PNG

PNG encode is the largest single paint cost at desktop — instrumented
`canvas.toBuffer('image/png')` measures **~44ms at 1280x800** and **~9ms at
320x568** (this run; see the `verify:paint-perf` printout). We
chose to keep the PNG encoder exactly as it is and make it skippable, rather
than cheapen it or defer it lazily:

- `renderHtml(html, { encodePng: false })` returns **raw, unpremultiplied RGBA
  pixels** (width\*height\*4 bytes) in `out.rgba` instead of a PNG — the canvas
  surface's raw buffer, near-free (`~0.2ms` at 1280x800) compared to the
  encoder's ~44ms.
- The public **rgba-PNG contract is untouched for default consumers**:
  `encodePng` defaults to `true`, so `out.rgba` stays the PNG-encoded buffer
  every verify screenshot gate diffs. The gate itself asserts the contract once
  per run (a default render emits real PNG magic bytes).
- The perf bench and gate measure the raw path, with the encode share reported
  per viewport so the number is never mistaken for "the engine skips paint".

### Measured numbers (kitchen-sink, mean over 5, this host)

| Viewport | renderHtml (PNG) | renderHtml (raw) | encode share | gate threshold |
| --- | --- | --- | --- | --- |
| 1280x800 | ~89ms | **~46ms** | ~44ms | < 60ms |
| 320x568 | ~41ms | **~33ms** | ~9ms | < 48ms |

Both thresholds pass with margin (`npm run verify:paint-perf`), putting the
engine's full painted render within ~1.4x of Chrome's render-to-FCP on the
page-scale fixtures (was ~2.0–2.4x).

### Paint stopped re-measuring text that layout already measured

Per-render instrumentation showed 727 `measureText` calls (~13.4ms), of which
paint added ~60 fresh: the per-glyph prefix-advance measures `paintTextRun`
made to place letter-spaced glyphs (e.g. the `.tracked` paragraph's ~58
prefixes). Layout now precomputes each letter-spaced run's per-character
x-offsets once (`letterSpacedOffsets` in `block-inline.ts`, stored on the run as
`charXs`) and paint draws straight from them — glyph placement is byte-identical
(verified against the old measure-in-paint path over all three kitchen-sink
viewports), and paint itself performs no measurement.

### What was not changed

Layout geometry, computed styles, rects, and the measure seam are untouched and
still gated by their own suites (`verify:measure-perf` passes). The screenshot
parity gates stay green byte-for-byte: `verify:four-layer`, `verify:stress`,
`verify:paint-text`, `verify:shadow`, `verify:opacity`, `verify:border-radius`,
`verify:lists`, `verify:pseudo-elements`, `verify:media-queries`,
`verify:overflow`, `verify:text-measure`, `verify:rect-contract`,
`check-charter`.

## Corpus

- Spine: `corpus/spine/` — basic-text, boxes, inline-styles, replaced-boxes,
  wrapping (all four-layer).
- Measure: `corpus/measure-corpus/` — 96 strings across 10 categories.
- Segmentation: `corpus/segmenter/` — 72 strings, 5 categories.

## Divergences

The substantive divergences are items 1–6 above; the seven text-measure gaps
are closed (7 → 0, item 4). The one tolerance change is the text-region tier
(`tolerances.json` v2), recorded in `tolerances.md` and `text-mask.md`.
