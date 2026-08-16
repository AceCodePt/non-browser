# Firefox-Track Ledger

Owning module: `src/config/` (per-browser browser-configs; `firefox.ts` is this
task's deliverable), driving the existing font-resolution seam in
`src/layout/measure.ts` / `src/layout/paint.ts` / `src/layout/render.ts`. Corpus:
`corpus/firefox-track/`. Verified via `npm run verify:firefox` against Playwright
Firefox on all four layers (charter §2 tolerances).

## Scope

The charter's target-browser contract (§4) says a `browser-config` selects the
fallback table and the golden corpus while sharing the same skia Canvas
interface and layout/paint pipeline. This task adds the `browser: 'firefox'`
config path:

- **`src/config/browser-config.ts`** — the `BrowserConfig` type (font-registration
  set + fallback table + default family/file) and `resolveFontFamily`, which
  resolves a CSS font-family string deterministically: explicit registrations
  first, then the selected browser's fallback table, else the default family.
- **`src/config/chrome.ts`** — the default `chrome` config (baseline; chrome
  corpus authored against it, unchanged by this task).
- **`src/config/firefox.ts`** — the firefox config: registers the firefox font
  set (`Source Code Pro`, `Nimbus Mono PS`) and carries the firefox fallback
  table.
- **`src/config/index.ts`** — `getBrowserConfig(target)` registry.

The engine seam: `renderHtml` accepts `browserConfig`, registers its font set,
and makes it the active config; `measureTextWidth` and the paint text run both
resolve the family through the active config before hitting the canvas. Chrome
behavior is byte-identical (chrome config registers the same FONT_FILE/FONT_FAMILY
and has an empty fallback table).

## Firefox fallback table

Populated from oracle measurements (Firefox `measureText` for each CSS family vs
the engine's registered faces) — entries where Gecko resolves a family to a
different concrete font than the engine's own font lookup would:

| CSS family | Registered face | Rationale |
| --- | --- | --- |
| `Courier New` | `Source Code Pro` | Firefox resolves `Courier New` to a Courier-metric mono face; skia's raw lookup measures it as a different (narrower) font. `Source Code Pro` reproduces Firefox's advances exactly at 12–24px (mean Δ 0.0000px). |
| `Liberation Mono` | `Source Code Pro` | Same mono metrics Firefox uses; identical sub-pixel widths. |

`defaultFamily`/`defaultFile` = `Source Code Pro` — the face the firefox corpus
text is authored against, and the fallback-of-last-resort for unmatched families.

Explicitly **not** mapped: `monospace`/`sans-serif`/`serif`/`Arial` — Firefox
resolves these to faces whose advances do **not** reproduce any registered font
to sub-pixel (e.g. `monospace` diverges from `Source Code Pro`), so mapping them
would break layer-1 parity rather than fix it. The firefox corpus does not
author fixtures against them.

## Corpus (4 fixtures)

A subset of the chrome corpus (`corpus/spine` scenarios) plus a firefox-specific
font-fallback fixture:

| Fixture | Covers |
| --- | --- |
| `basic-text` | subset of `spine/basic-text`: two paragraphs in `Source Code Pro`, all four layers vs Firefox |
| `boxes` | subset of `spine/boxes`: box model (margins/padding/border/background) in `Source Code Pro` |
| `wrapping` | subset of `spine/wrapping`: multi-line paragraph, greedy breaking, Pretext seam |
| `fallback-courier-new` | firefox-specific: text authored `font-family:'Courier New'`; the engine resolves it through the firefox fallback table to `Source Code Pro` and measures/lays out identically to Firefox |

## Fixtures diverging between chrome and firefox configs

`fallback-courier-new` is the one fixture that meaningfully diverges by config:
under the chrome config the engine would resolve `Courier New` to its own font
lookup (a different width than Firefox), and only the firefox fallback table
routes it to `Source Code Pro`, matching the Gecko oracle. The three subset
fixtures pass under both configs (the text is authored in a registered face).

## Method

`npm run verify:firefox` rebuilds, launches Playwright Firefox, harvests the
oracle quantities (measureText, getComputedStyle, getBoundingClientRect,
screenshot, text fragments), renders each fixture with `browserConfig:
firefoxConfig`, and evaluates all four layers under `tolerances.json` (charter
defaults, version 1). Reference/candidate JSON+PNGs and the text mask are
written into each fixture dir as golden data.

The Pretext seam is fed each text element's **real computed font-family**
(harvested from the element, not the config's hard-coded default family), so
the seam exercises the same fallback table the engine measure path does: a
fixture whose element uses an unregistered family (e.g. `Courier New`) is
resolved through the firefox fallback table to the registered face before the
Canvas is touched. The seam gates on the **layer-1 mean AND max** tolerances
(mean ≤ 0.01px, max ≤ 0.5px) — the fallback fixture resolves to Source Code
Pro, which Firefox reproduces exactly, so its seam mean is 0.0000px.

## Results

`npm run verify:firefox` exits 0 — all 4 fixtures pass all four layers, every
row at 0.0000px / 0 exceeding pixels (text masked, as in the paint-text
corpus), and the seam (real resolved family) passes every fixture with mean Δ
0.0000px incl. the `fallback-courier-new` fixture. `npm run verify:four-layer`
still exits 0 — the chrome path is unregressed.

## Divergences

None within the verified surface. The Firefox-vs-Chrome font resolution
divergences (`monospace`, `sans-serif`, `serif`, `Arial`, …) are intentionally
not encoded in the fallback table because no registered face reproduces Gecko's
advances to sub-pixel; authoring fixtures against them would fail layer-1
measureText parity, so they are documented here instead.
