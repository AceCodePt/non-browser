# Non-browser Charter: Browser-Parity Server-Side Renderer

Status: Ratified. This document is the source of truth for scope, tolerances, and contracts; downstream tasks implement against it and may only relax it by amending the charter.

## 1. Mission

A server-side HTML/CSS renderer — an npm TypeScript library, no DOM, no Playwright in the product — that produces a static pixel buffer matching a target browser (Chrome first) for the same input. The engine is fed generic HTML/CSS strings or `@ace-code/shast` `renderComponent` output. Playwright is a test-only oracle. The parity target: layout and metrics exact; rasterization absorbs Skia-vs-Skia differences within the 5% band defined below.

## 2. Four-Layer Parity Model

Parity against the target browser is measured across exactly four layers, each with a concrete tolerance:

| Layer | Oracle quantity | Tolerance |
| --- | --- | --- |
| 1. Text measurement | `canvas.measureText` (width) | Sub-pixel: default `<0.01px` mean, no single string `>0.5px` |
| 2. Style resolution | `getComputedStyle` | exact string equality |
| 3. Geometry | `getBoundingClientRect` | `<=0.5px` per box (x, y, width, height) |
| 4. Paint | screenshot pixels | Per-pixel delta-E <=2, with <=1% of pixels exceeding |

The four layers are independent and each fixture records expectations for all four (see §7).

## 3. Scope Constraints (v1)

The following are **in scope** for v1:

- Full CSS layout, landed in a defined order: block/inline → positioning → floats → flexbox → grid **last**.
- Text: layout over a generic Canvas interface (`measureText` + paint primitives). The engine's own line/word wrapper (`block-inline.ts`/`measure.ts`) is the shipped breaking path; `@chenglou/pretext` prepare/layout is the break-parity test seam over the same interface (see `docs/ledgers/parity.md`, Honest Reading #3). Skia is the first implementation; CoreText/HarfBuzz may follow behind the same interface.
- Replaced boxes at layout size for `<canvas>` and `<img>`.

The following are **out of scope** for v1 and must not appear as scope commitments in any task:

- Image decoding: none in v1. `<img>` renders as an empty replaced box at layout size; no image decoding, no decode of image payloads.
- Animation, GPU rasterization paths, canvas-API output (no drawing API results exposed), and SVG.
- DPR is fixed at 1; any DPR scaling is out of scope.
- The viewport is an input (width/height passed to the renderer), not inferred from content.

Font parity is mandatory: fonts are both registered into the engine **and** installed for the oracle so both resolve identical glyphs.

## 4. Target Browser Contract

The renderer takes a **`browser`-config parameter** (a `browser-config`) that selects the target browser and everything that depends on it:

- **`chrome`** (default, first): Chrome/Blink fallback tables and the primary golden corpus.
- **`firefox`** (later): Firefox/Gecko fallback tables and a Firefox golden corpus; same Skia substrate, differs only in fallback/font config.
- **`safari`** (parked for browser parity): the `safari` browser-config exists to the extent of glyph resolution (`src/config/safari.ts` — font-registration set + fallback table over the same Canvas seam), but the WebKit oracle is tracked on macOS CI and not scheduled until the platform is provisioned. Probes/seam checks consult the WebKit oracle when it launches and otherwise fall back to a documented reference (see `docs/ledgers/safari.md`).

The `browser-config` selects:

- **Fallback tables**: per-browser font-fallback tables (keyed by browser target in `src/config/`) that define resolution order for common families and missing-glyph cases. The engine resolves a CSS font stack deterministically: explicit registrations first, then the selected browser's fallback table.
- **Golden corpora**: `corpus/<feature>/` fixtures are tagged with the target browser(s) they apply to; a browser config runs the corpus subset for that target.

## 5. Input Contract

- Input is **HTML + CSS strings** — no DOM objects, no document state.
- The same strings may come from either source:
  1. **Generic** HTML/CSS authored for the corpus, or
  2. **`@ace-code/shast`** `renderComponent` output rendered through the same pipeline.
- Both sources produce **the same strings** through the identical code path; a fixture declares which source it uses, and parity holds regardless of source.

## 6. Runtime Pin

- **Node `>=20` with full-icu.** The verify scripts fail fast if the runtime is below the floor, `Intl.Segmenter` is missing, or ICU data is not full.
- **`Intl.Segmenter` is required** — Pretext segments text (grapheme granularity) via `Intl.Segmenter`; segmentation parity with the browser's ICU must hold.
- **`process.versions.icu` is recorded** in `docs/ledgers/icu.md`, alongside the Chrome/Playwright ICU and Chromium versions used by the oracle, on every segmentation verification run.

## 7. Playwright: Test-Only Oracle

- Playwright drives the headless target browser only to harvest oracle quantities: `measureText`, `getComputedStyle`, `getBoundingClientRect`, and screenshots.
- Playwright is a **devDependency and test-only oracle, never a product dependency**. The library must not import or depend on Playwright at runtime.

## 8. Corpus Layout

- Corpus lives under **`corpus/<feature>/`** — one directory per independent task (e.g. `corpus/spine/`, `corpus/measure-corpus/`, `corpus/fonts/`, `corpus/segmenter-icu/`, `corpus/firefox-track/`).
- Each fixture records **four-layer expectations**: the expected `measureText` values, computed-style strings, rects, and a golden screenshot / pixel expectation, per the tolerances in §2.
- Fixtures are tagged with the target browser(s) they apply to; the browser config runs the matching subset (§4).
- A fixture that intentionally diverges in a known region is paired with a mask file (see the harness task); masked regions are excluded from the pixel diff while all other pixels stay strict.

## 9. Ledgers

Operational results, decisions, and divergences are recorded under `docs/ledgers/`:

- `text-measure.md` — layer-1 per-string widths, deltas, pass/fail, failing fonts.
- `icu.md` — `process.versions.icu`, Chrome/Chromium ICU versions, segmentation results.
- `fonts.md` — fallback tables, font set, glyph-resolution divergences.
- `breakers.md` — Pretext segmentation/breaking decisions.
- `parity.md` — aggregate four-layer results and corpus additions/removals.
- `tolerances.md` — any recorded change to charter tolerances (defaults are the §2 values).
- `firefox.md` — firefox fallback-table decisions and chrome/firefox divergences.

## 10. Parity Target

- Layout and metrics (layers 1–3) must be **exact** within the §2 tolerances.
- Rasterization (layer 4) targets the same Skia-vs-Skia band: delta-E <=2, with <=1% of pixels exceeding, for **non-text pixels** — the aggregate report tracks the pixel-parity percentage against the 95–99% target. The two Skia instances (Chrome's compositor vs `@napi-rs/canvas`) apply different font hinting/AA, so **text pixels are compared under a documented tiered text-region tolerance** (`tolerances.json` `layers.screenshot.text`, justified by `scripts/probe-text-mask.mjs` → `docs/ledgers/text-mask.md`) instead of being masked. Text pixels are therefore compared and reported (per-fixture text-region ΔE and text-pixel mask share) rather than silently excluded; their per-pixel ΔE threshold is unchanged at <=2, only the within-region exceed allowance is tiered.

## 11. Coverage Matrix

The coverage matrix is the machine-checked contract between the charter's
implemented/tested claims and the code+corpus. `scripts/check-charter.mjs`
parses this table and fails when a row drifts from the engine or the corpus, so
the charter and the corpus cannot silently diverge:

- `Implemented` must be `yes`/`no`; `yes` requires the **Token** to appear in
  the engine source (`src/**/*.ts`).
- `Tested (corpus)` lists corpus directories (relative to `corpus/`, comma-
  separated) whose fixtures must exercise the **Token** (the token appears in at
  least one `fixture.json` under the directory); `-` means implemented but not
  corpus-covered yet. A new corpus or a fixture that stops exercising a claimed
  property fails the check rather than being silently dropped.

| Feature | Property | Implemented | Tested (corpus) | Token |
| --- | --- | --- | --- | --- |
| flex | flex-grow | yes | corpus/flexbox | flex-grow |
| flex | flex-shrink | yes | corpus/flexbox | flex-shrink |
| flex | flex-basis | yes | corpus/flexbox | flex-basis |
| flex | flex-direction | yes | corpus/flexbox | flex-direction |
| flex | flex-wrap | yes | corpus/flexbox, corpus/sweep-flexbox | flex-wrap |
| flex | justify-content | yes | corpus/flexbox, corpus/sweep-flexbox | justify-content |
| flex | align-items | yes | corpus/flexbox, corpus/sweep-flexbox | align-items |
| flex | align-content | yes | corpus/flexbox | align-content |
| flex | align-self | yes | corpus/flexbox | align-self |
| flex | order | yes | corpus/flexbox | order |
| flex | gap | yes | corpus/flexbox, corpus/sweep-flexbox, corpus/sweep-grid | gap |
| grid | grid-template-columns | yes | corpus/grid, corpus/sweep-grid | grid-template-columns |
| grid | grid-template-rows | yes | corpus/grid | grid-template-rows |
| grid | fr tracks | yes | corpus/grid, corpus/sweep-grid | fr |
| grid | minmax() | yes | corpus/grid, corpus/sweep-grid | minmax |
| grid | repeat() | yes | corpus/grid, corpus/sweep-grid | repeat |
| grid | grid-auto-flow | yes | corpus/grid | grid-auto-flow |
| grid | dense | yes | corpus/grid | dense |
| grid | alignment | yes | corpus/grid | justify-items |
| block/inline | width | yes | corpus/spine, corpus/floats, corpus/positioning | width |
| block/inline | height | yes | corpus/spine, corpus/positioning | height |
| block/inline | margin | yes | corpus/spine, corpus/floats, corpus/positioning | margin |
| block/inline | padding | yes | corpus/spine, corpus/positioning | padding |
| block/inline | float | yes | corpus/floats | float |
| block/inline | position | yes | corpus/positioning | position |
| block/inline | z-index | yes | corpus/positioning | z-index |
| block/inline | box-sizing | yes | corpus/spine | box-sizing |
| text | white-space | yes | corpus/spine, corpus/white-space | white-space |
| text | letter-spacing | yes | corpus/paint-text, corpus/measure-corpus | letter-spacing |
| text | text-decoration | yes | corpus/paint-text | text-decoration |
| text | text-shadow | yes | corpus/box-shadow | text-shadow |
| paint | box-shadow | yes | corpus/box-shadow | box-shadow |
| font | font-family (fallback tables) | yes | corpus/cross-family, corpus/firefox-track | font-family |
| ua-stylesheet | UA defaults at lowest cascade priority | yes | corpus/ua-styles | UA stylesheet |
| lists | list-style-type markers | yes | corpus/lists, corpus/ua-styles | list-style-type |
| lists | list-style-position | yes | corpus/lists | list-style-position |
