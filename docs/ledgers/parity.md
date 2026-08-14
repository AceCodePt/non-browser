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
- layer-4 `screenshot` — per-pixel ΔE ≤ 2, ≤ 1% of pixels exceeding.

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

## Honest Reading (what the green run does and does not prove)

The headline numbers are real but incomplete. The following limit the claims
the green run supports, in order of impact.

### 1. Layer-4 never compares glyph pixels

Every text fixture masks all text-fragment pixels from the screenshot diff
(`scripts/verify-four-layer.mjs` builds the mask from Chrome's line-fragment
rects, plus declared rects). The observed `0.0000` worst/mean ΔE is therefore
over **non-text pixels only** — background, borders, box fills. Masked share
in the text fixtures: wrapping 35% (22552 of 64400 px), inline-styles 25%
(14003 of 55200 px), replaced-boxes 12.5% (11504 of 92000 px). Because engine
and oracle both rasterize via Skia, the charter's
§10 "same Skia-vs-Skia band" for glyphs is **not actually tested**. The pixel
parity percentage should be read as "non-text pixels".

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
`text-measure.md`. No charter tolerance changes are recorded here; see
`tolerances.md`.
