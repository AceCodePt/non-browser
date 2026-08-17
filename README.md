# cascade-core

A server-side HTML/CSS renderer that produces a pixel buffer matching Chrome —
**no DOM, no browser process, no Playwright or Puppeteer anywhere in the product.**

Feed it an HTML string, get back the same four quantities a browser would give
you: text widths, computed styles, element rects, and a painted buffer. The
point is to take the browser out of the equation entirely, so a program — or an
AI agent — can get layout and measurement in-process, deterministically, and
~3× faster than Chrome's own render.

```
npm install
npm run verify        # engine vs real Chrome, four layers, sub-pixel tolerances
```

## At a glance (all numbers reproducible via `npm run verify` / `npm run bench:engine-vs-oracle`)

| Quantity | Result | What it means |
| --- | --- | --- |
| Text measurement | 96/96 strings, **mean Δ 0.0025px**, worst 0.0300px | engine `measureText` ≈ Chrome's, sub-pixel |
| Documented text-measure gaps | **7 → 0** | every known divergence closed and reclassified |
| Box geometry (spine) | **max Δ 0.0000px** | `getBoundingClientRect`-identical to Chrome |
| Box geometry (110-fixture flex/grid sweep) | **110/110 pass, rect max Δ 0.0104px** | every swept combo within the ≤ 0.5px band |
| Computed style | exact string equality, 0 mismatches | `getComputedStyle` identical |
| Screenshot, non-text pixels | **0 exceeding** on spine + layout/paint suites (ΔE ≤ 2, ≤ 1%) | paint matches Chrome on everything that isn't glyph-ink |
| Render speed | **2.1–3.6× faster than Chrome's own render** (engine takes 0.28–0.48× of Chrome's time) | engine beats Chrome rendering the same HTML |

Every number above is a real measurement against headless Chrome, not an
estimate. The last section tells you exactly what they do *not* prove.

## Why no browser

Getting layout from a browser means launching one: a heavyweight process, a
serialization round-trip for the DOM, another for computed style, another for
rects, another for a screenshot — each non-deterministic, each slow, each
feeding an agent a sprawling API surface instead of an answer.

This library replaces that whole pipeline with a function call:

```ts
import { renderHtml } from 'cascade-core';

const out = renderHtml(html, {
  width: 800,          // viewport — required, never inferred from content (§3)
  height: 600,
  fontFamily: 'Noto Sans',
  fontFile: '/path/to/NotoSans-Regular.ttf',
  // browserConfig: getBrowserConfig('chrome'),  // target browser (§4); default: chrome
});

out.rgba           // layer 4: the painted page (PNG-encoded buffer)
out.rects          // layer 3: per-id border-box rects (getBoundingClientRect)
out.computedStyles // layer 2: computed-style strings (getComputedStyle)
// layer 1: text widths come from the same measurement engine the paint used
```

A runnable version of this exact flow — input, the four layers' output, and
a written PNG — lives in `examples/basic-render.mjs`
(`node examples/basic-render.mjs`).

### The API contract

`src/index.ts` is the entire public surface (`dist/index.js` in the built
package; `exports` allows no other path for a package consumer). Everything
else under `src/` is internal.

- **Input (`§5`)** — one HTML string that carries its own CSS, either generic
  corpus HTML or `@ace-code/shast` `renderComponent` output. Both are plain
  strings through the identical code path; no DOM objects, no document state.
- **Viewport (`§3`)** — `width` and `height` are required inputs. DPR is fixed
  at 1; the engine draws into exactly the viewport you pass.
- **Browser config (`§4`)** — pass a `browserConfig` (`getBrowserConfig('chrome' |
  'firefox' | 'safari')`, or `chromeConfig` / `firefoxConfig` / `safariConfig`)
  to select the target browser's font-fallback tables and font-registration
  set. Omitted, the engine builds a `chrome` config from `fontFamily` /
  `fontFile`, which name the font single-face measure/paint use. Chrome is the
  default and the primary golden corpus.
- **Output** — `rgba` is a **PNG-encoded `Buffer`** of the painted viewport;
  `rects` maps every `id` in the input to that element's **border-box** rect
  (`getBoundingClientRect` semantics, fractional-safe); `computedStyles` holds
  layer-2 strings for the `computedStyle` specs you passed; `generatedTextRects`,
  `textFragments`, and `listMarkers` are the layer-1/3/4 extras the parity
  harness compares against the oracle. Passing `media` drives `@media`
  resolution (`prefers-color-scheme`, `prefers-reduced-motion`, `dppx`).

The four-layer parity claim is the §2 table in "Engine vs Chrome" below: for
the corpus, every output quantity above matches the oracle within those
tolerances.

For an agent that needs to answer "does this card overflow?", "what is the width
of `#header`?", "how tall is this paragraph at 640px?" — you call a function
that returns the answer in milliseconds. No process to spawn, no page to wait
for, nothing to parse.

## The two methods of comparison — and what each actually compares

The project is honest about the difference between "the engine matches Chrome"
and "Chrome and Firefox happen to agree". They are measured separately.

### 1. Engine vs Chrome — the four-layer parity harness (`npm run verify`)

Playwright drives real headless Chrome **only as a test oracle** (a
`devDependency`; the library never imports it). Both sides render the same HTML
and the harness diffs four independent quantities:

| Layer | Oracle quantity | Tolerance | Current result |
| --- | --- | --- | --- |
| 1. Text measurement | `canvas.measureText` width | mean ≤ 0.01px, no string > 0.5px | mean 0.0025px, 96/96 pass |
| 2. Style resolution | `getComputedStyle` | exact string equality | 0 mismatches |
| 3. Geometry | `getBoundingClientRect` | ≤ 0.5px per box dimension | max Δ 0.0000px |
| 4. Paint | screenshot pixels | ΔE ≤ 2, ≤ 1% exceeding (non-text) | 0 exceeding |

This is the claim behind every number above: **for the corpus, the engine and
Chrome agree within sub-pixel on layout and metrics, and pixel-identically on
non-text paint.** The corpus spans block/inline, floats, positioning, flexbox,
grid, text scripts (Latin/CJK/Thai/Arabic/emoji), white-space modes, lists,
pseudo-elements, media queries, and a 110-fixture generated sweep.

### 2. Browser vs browser — the cross-browser probe (`npm run probe:browser-gap`)

A separate probe renders the same HTML in **Playwright Chrome and Playwright
Firefox, with no engine in the loop**, and diffs the four layers directly. It
answers a different question: *do the browsers already agree?*

Result: layout and measurement are **byte-identical** across browsers
(rect max Δ 0.0000px, computedStyle 0 mismatches); only font *resolution* and
glyph rasterization differ. That is why one target (Chrome) is enough — the
engine only has to reproduce the layout every browser shares, plus Chrome's
font fallback decisions, which is handled by per-browser fallback tables
(`src/config/`, charter §4).

### 3. Engine time vs Chrome time vs harness time — the perf bench (`npm run bench:engine-vs-oracle`)

The bench reports three separate times so "fast" is never conflated with "the
harness is fast":

- **Engine** — wall-clock of `renderHtml` in-process (parse → cascade → layout → paint).
- **Chrome render** — Chrome's own cost to first paint for the same HTML, measured *inside the page* via `PerformanceObserver`, not harness wall-clock.
- **Harness** — the full Playwright oracle path (page setup + per-quantity `evaluate` round-trips + screenshot).

Honest reading of the warm run: the engine renders the same HTML **2.1–3.6×
faster than Chrome itself** (Chrome's render time ÷ engine time; the engine
takes 0.28–0.48× of Chrome's time). The full Playwright oracle path is ~5.8×
Chrome's render wall-clock, and **83% of that is harness overhead** — page
setup and round-trips, not Chrome rendering. Earlier "28×" headlines had
billed the harness's round-trips against the engine; this bench splits them so
nobody can repeat that mistake.

## What these numbers do NOT prove (kept on the record)

The ledger `docs/ledgers/parity.md` maintains this list explicitly. The honest
reading:

- **Text pixels are compared under a tiered tolerance, not a strict pass.**
  The two Skia rasterizers (Chrome's compositor vs `@napi-rs/canvas`) hint
  glyphs differently — 60–74% of glyph-interior pixels exceed ΔE 2 even though
  Chrome's own canvas is 73% divergent from its own DOM text. So text pixels
  are *reported and compared* under a documented 97%-within-region tier, not
  silently excluded and not claimed as pixel-identical. Non-text pixels are
  strict.
- **The green run proves parity for the verified corpus, not arbitrary HTML.**
  The corpus is authored alongside the engine; features it doesn't exercise
  (yet) are documented in the coverage matrix and `tasks/`, not implied to work:
  `calc()`, opacity compositing, `direction: rtl` box layout, tables, and image
  decoding are not in v1. box-shadow/text-shadow paint is corpus-covered
  (`corpus/box-shadow/`, `npm run verify:shadow`): offset/blur/spread/color +
  inset + multiple + text-shadow; blurred shadows with spread and blurred inset
  remain unpainted (parsed and serialized, but skipped at paint time).
- **The engine's shipped text wrapping is still narrower than the seam.**
  Break-parity with Chrome is proven for the Pretext-based seam; the shipped
  greedy wrapper for plain text is being unified onto it (`pretext-breaker-path`
  task).
- **Parity is font-set-bound.** The engine reproduces Chrome's *registered*
  font fallback; numbers reproduce where the same fonts resolve the same way.
  Font registration is `src/config/`; a machine-independent font bundle is open
  work.
- **Two typed gaps remain by design:** `@container` is parsed but not applied
  (no container sizing), and one fixture deliberately diverges to prove the
  screenshot gate fails as designed. Both are asserted, not hidden.

## Where the numbers live

Everything here is generated, not hand-written: `npm run verify` writes the
per-layer reports and the ledgers under `docs/ledgers/` (`parity.md`,
`text-measure.md`, `sweep.md`, …), and `check-charter.mjs` fails the build if
the charter's claims drift from the engine or the corpus. The charter
(`docs/charter.md`) is the source of truth for scope and tolerances; the
orchestration that keeps the work honest lives in `.orchestration/`.
