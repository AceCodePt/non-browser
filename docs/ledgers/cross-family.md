# Cross-Family LAYOUT + Fallback-Table Ledger

Owning seam: `src/config/` (`chrome.ts`, `firefox.ts` browser-configs and their
fallback tables) exercised at **layout time** through the shared seam in
`src/layout/measure.ts` / `src/layout/paint.ts`. Corpus: `corpus/cross-family/`,
verified via `npm run verify:cross-family` against the per-fixture oracle
browser (Chromium for `browser: "chrome"` fixtures, Firefox for
`browser: "firefox"`) on all four layers (charter §2 tolerances).

## Scope

The coverage task requires fixtures whose CSS font stacks resolve through the
browser-config fallback tables at layout time — not just per-string
measurement — so `chrome.ts`/`firefox.ts` are actually exercised. Each fixture
declares its target browser (`fixture.browser`); `verify-cross-family.mjs`
launches the matching Playwright browser, harvests oracle quantities, renders
the engine with the matching browser-config, and diffs all four layers.

## Fallback tables (expanded by this task)

The chrome config now registers the cross-family faces already on disk
(Liberation Serif/Sans/Mono, DejaVu Sans, Source Code Pro, Droid Sans Fallback,
Noto Sans) and carries a fallback table populated from oracle measurements —
CSS families Chrome resolves to those faces on this system:

| CSS family | Registered face | Rationale |
| --- | --- | --- |
| `Times New Roman` | `Liberation Serif` | Chrome/fontconfig metric-compatible; identical advances. |
| `Georgia` | `Liberation Serif` | Same resolution. |
| `serif` | `Liberation Serif` | Generic serif resolves to Liberation Serif on this system. |
| `Arial` | `Liberation Sans` | Chrome/fontconfig metric-compatible. |
| `sans-serif` | `Liberation Sans` | Generic sans resolves to Liberation Sans on this system. |
| `Courier New` | `Liberation Mono` | Chrome/fontconfig metric-compatible. |

The firefox config's existing table (`Courier New`, `Liberation Mono` →
`Source Code Pro`) is exercised by the firefox-targeted fixtures here and in
`corpus/firefox-track/`.

## Corpus (6 fixtures)

| Fixture | Browser | Stack | Resolves to | Covers |
| --- | --- | --- | --- | --- |
| `times-new-roman` | chrome | `'Times New Roman', serif` | Liberation Serif (chrome table) | chrome fallback at layout; wrapping/paint with the resolved face |
| `georgia-stack` | chrome | `Georgia, 'Liberation Serif', serif` | Liberation Serif (chrome table) | multi-family stack in layout |
| `arial-sans-stack` | chrome | `Arial, 'Liberation Sans', sans-serif` | Liberation Sans (chrome table) | sans branch of the chrome table |
| `droid-sans-fallback-cjk` | chrome | `'Droid Sans Fallback'` | registered directly | non-Latin face at layout |
| `firefox-courier-new` | firefox | `'Courier New'` | Source Code Pro (firefox table) | non-trivial fallback via the firefox table |
| `firefox-liberation-mono` | firefox | `'Liberation Mono', 'Courier New', monospace` | Source Code Pro (firefox table) | multi-family stack landing on Source Code Pro |

## Latest Run

- Generated: 2026-08-14
- Fixtures: 6/6 PASS on all four layers (measureText mean Δ ≤ 0.005px, rect max
  Δ 0.0000px, screenshot 0 exceeding; text masked per the firefox-track pattern).

## Divergences

None — every cross-family fixture reproduces its oracle browser. This is
expected: the fallback tables are populated from oracle measurements, so each
CSS family maps to a face whose advances the engine reproduces to sub-pixel.
