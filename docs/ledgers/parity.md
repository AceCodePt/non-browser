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
its engine divergences as typed gap fixtures (36 of 110 swept combos) — see
`docs/ledgers/sweep.md` for the full list and per-combo deltas. Each reduction
requires closing the divergence the declaration documents; the fixtures assert
the divergence still exists, so a stale or removed declaration fails
`npm run verify`.

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

### 5. Flexbox baselines are hard-coded, and the Firefox zeros are tautological

Three baseline formulas exist (block-inline, flexbox's hard-coded Noto
fractions `1069/1000`/`293/1000`, paint via fontmetrics). Flexbox ignores the
active browser config, so under `firefoxConfig` its baselines are wrong by
construction. The Firefox seam reporting Δ 0.0000px is expected: it compares
the engine against its own constants, not a browser-derived measurement.

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

## Firefox/Safari support task

A new task (`browser-canvas-support`, `wait_human_start: true`) takes the probe
result forward: exercise the firefox browser-config through the engine *and*
the Pretext seam (seam passes the fixture's real CSS family, not the default),
and add a Safari browser-config to the extent of glyph resolution — the correct
canvas must be pressed into Pretext so the seam and the engine measure the same
per-browser faces.

## Performance: Engine vs Playwright Oracle

Measured on the spine fixtures with a warm browser (as the verify scripts run),
mean wall-clock per fixture:

| Fixture | Engine layout+paint | Chrome oracle (full harness) | Ratio |
| --- | --- | --- | --- |
| basic-text | 22.0ms | 476ms | 21.6x |
| inline-styles | 11.4ms | 634ms | 55.4x |
| wrapping | 17.2ms | 379ms | 22.1x |
| boxes | 14.7ms | 321ms | 21.9x |

- Sum over the four fixtures: engine **65ms** vs oracle **1809ms** (~28x).
- Cold Chrome launch adds ~270ms; the per-fixture oracle cost is 320–640ms of
  page load, `fonts.ready`, serialized `evaluate()` calls (rects, measureText,
  computedStyle, fragments), and a screenshot.
- Whole-suite wall-clock (all 11 verify scripts): **~111s**, dominated by
  Playwright; engine work is a few hundred ms of that.
- The engine is not faster than Chrome's own rendering — it is ~28x faster
  than the Playwright **verification harness**. The oracle cost scales with
  per-quantity `evaluate` round-trips; batching all quantities into one
  `evaluate` per fixture would cut Chrome-side time severalfold.

## Corpus

- Spine: `corpus/spine/` — basic-text, boxes, inline-styles, replaced-boxes,
  wrapping (all four-layer).
- Measure: `corpus/measure-corpus/` — 89 strings across 8 categories.
- Segmentation: `corpus/segmenter/` — 72 strings, 5 categories.

## Divergences

The substantive divergences are items 1–6 above and the seven gaps in
`text-measure.md`. The one tolerance change is the text-region tier
(`tolerances.json` v2), recorded in `tolerances.md` and `text-mask.md`.
