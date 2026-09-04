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
- Table formatting context (css-tables-3), separate-borders model: auto and
  fixed table layout, anonymous box generation, spanning, captions,
  border-spacing, empty-cells. The collapsing-borders model
  (`border-collapse: collapse`, css-tables-3 §4) is landed by the
  `tables-border-collapse` slice.
- Text: layout over a generic Canvas interface (`measureText` + paint primitives). The engine's shipped breaking path is `@chenglou/pretext` prepare/break over the same interface (`src/layout/measure.ts` routes `layoutTextLines` through `breakNextLine`; see `docs/ledgers/breakers.md`). The greedy space-break wrapper survives only as the flagged `CASCADE_BREAKER=greedy` fallback that the drift gate pins to Pretext. Skia is the first implementation; CoreText/HarfBuzz may follow behind the same interface.
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
| flex | flex-direction | yes | corpus/flexbox, corpus/stress | flex-direction |
| flex | flex-wrap | yes | corpus/flexbox, corpus/sweep-flexbox | flex-wrap |
| flex | justify-content | yes | corpus/flexbox, corpus/sweep-flexbox, corpus/stress | justify-content |
| flex | align-items | yes | corpus/flexbox, corpus/sweep-flexbox, corpus/stress | align-items |
| flex | align-content | yes | corpus/flexbox | align-content |
| flex | align-self | yes | corpus/flexbox | align-self |
| flex | order | yes | corpus/flexbox, corpus/stress | order |
| flex | gap | yes | corpus/flexbox, corpus/sweep-flexbox, corpus/sweep-grid, corpus/stress | gap |
| grid | grid-template-columns | yes | corpus/grid, corpus/sweep-grid, corpus/stress | grid-template-columns |
| grid | grid-template-rows | yes | corpus/grid | grid-template-rows |
| grid | fr tracks | yes | corpus/grid, corpus/sweep-grid, corpus/stress | fr |
| grid | minmax() | yes | corpus/grid, corpus/sweep-grid, corpus/stress | minmax |
| grid | repeat() | yes | corpus/grid, corpus/sweep-grid, corpus/stress | repeat |
| grid | grid-auto-flow | yes | corpus/grid | grid-auto-flow |
| grid | dense | yes | corpus/grid | dense |
| grid | alignment | yes | corpus/grid | justify-items |
| grid | grid-template-areas | yes | corpus/grid | grid-template-areas |
| grid | placement (grid-area/grid-column/grid-row, line names) | yes | corpus/grid | grid-area |
| grid | auto / implicit tracks (grid-auto-rows/columns) | yes | corpus/grid | grid-auto-columns |
| grid | item self-alignment (justify-self/align-self) | yes | corpus/grid | justify-self |
| value functions | calc() | yes | corpus/calc | calc( |
| value functions | min() | yes | corpus/calc | min( |
| value functions | max() | yes | corpus/calc, corpus/stress | max( |
| value functions | clamp() | yes | corpus/calc | clamp( |
| block/inline | width | yes | corpus/spine, corpus/floats, corpus/positioning, corpus/stress | width |
| block/inline | height | yes | corpus/spine, corpus/positioning, corpus/stress | height |
| block/inline | margin | yes | corpus/spine, corpus/floats, corpus/positioning, corpus/stress | margin |
| block/inline | padding | yes | corpus/spine, corpus/positioning, corpus/stress | padding |
| block/inline | border (width/style/color) | yes | corpus/spine, corpus/flexbox, corpus/border-radius, corpus/stress | border |
| block/inline | border-radius | yes | corpus/border-radius, corpus/stress | border-radius |
| block/inline | border-styles (dashed/dotted/double/groove/ridge/hidden) — dash/dot scaling, double gap with solid fallback below 3px, groove/ridge edge shading, hidden computing to used width 0, radius interplay | yes | corpus/border-styles | dashed |
| block/inline | background-color | yes | corpus/spine, corpus/border-radius, corpus/stress | background-color |
| block/inline | float | yes | corpus/floats, corpus/stress | float |
| block/inline | clear | yes | corpus/floats | clear |
| block/inline | position | yes | corpus/positioning, corpus/stress | position |
| block/inline | z-index | yes | corpus/positioning, corpus/stress | z-index |
| block/inline | box-sizing | yes | corpus/spine, corpus/stress | box-sizing |
| block/inline | inline-block (shrink-to-fit, baseline) | yes | corpus/inline-block, corpus/stress | inline-block |
| block/inline | vertical-align | yes | corpus/inline-block | vertical-align |
| block/inline | min/max width/height | yes | corpus/flexbox, corpus/stress | min-width |
| block/inline | overflow (hidden clip / BFC) | yes | corpus/border-radius, corpus/flexbox, corpus/overflow | overflow |
| text | white-space | yes | corpus/spine, corpus/white-space, corpus/stress | white-space |
| text | letter-spacing | yes | corpus/paint-text, corpus/measure-corpus, corpus/stress | letter-spacing |
| text | text-decoration | yes | corpus/paint-text | text-decoration |
| text | text-align | yes | corpus/text-align, corpus/stress | text-align |
| writing modes | direction (computed, inherited) | yes | corpus/rtl-layout, corpus/stress | direction |
| writing modes | logical margins/padding (inline-start/end per direction) | yes | corpus/rtl-layout, corpus/stress | margin-inline-start |
| writing modes | logical insets (inset-inline-start/end, §10.3.7 over-constraint) | yes | corpus/rtl-layout | inset-inline-start |
| writing modes | text-align start/end used value per direction | yes | corpus/rtl-layout, corpus/stress | text-align |
| writing modes | logical float placement (float:inline-start/end) | yes | corpus/rtl-layout | float:inline-start |
| writing modes | flex row main axis / column cross axis under rtl | yes | corpus/rtl-layout, corpus/stress | flex-direction |
| writing modes | grid column lines under rtl | yes | corpus/rtl-layout, corpus/stress | grid-template-columns |
| writing modes | unicode-bidi (computed per css-writing-modes-4 §3.1: normal/isolate/bidi-override/isolate-override/plaintext; UA isolate on block/[dir], isolate-override on bdo, plaintext on dir=auto pre/textarea; bdo dir feeding direction; no-UBA reordering boundary declared in docs/ledgers/unicode-bidi.md) | yes | corpus/unicode-bidi | unicode-bidi |
| text | color (fill) | yes | corpus/paint-text, corpus/spine, corpus/stress | color |
| text | text-shadow | yes | corpus/box-shadow | text-shadow |
| paint | box-shadow | yes | corpus/box-shadow, corpus/stress | box-shadow |
| paint | outline (outline-width/style/color/offset + shorthand, css-ui-4 §4; outline-style: auto computes but paints no focus ring — declared divergence in docs/ledgers/outline.md) | yes | corpus/outline | outline-width |
| paint | background-image gradients (linear/radial-gradient: angles, side/corner keywords, stops incl. lengths/percentages/hard stops/double positions, repeating forms, radial ending shapes) | yes | corpus/backgrounds | linear-gradient |
| paint | background layers (comma-list stacking, background-size/position/repeat incl. cover/contain/round/space, background-clip/background-origin incl. border-radius, full background shorthand; url() raster backgrounds chartered-out per docs/ledgers/backgrounds.md) | yes | corpus/backgrounds | background-clip |
| paint | opacity (subtree compositing + stacking context) | yes | corpus/opacity, corpus/stress | opacity |
| font | font-family (fallback tables) | yes | corpus/cross-family, corpus/firefox-track, corpus/stress | font-family |
| font | font-size | yes | corpus/paint-text, corpus/spine, corpus/stress | font-size |
| font | font-weight / font-style | yes | corpus/ua-styles, corpus/stress | font-weight |
| font | line-height | yes | corpus/spine, corpus/paint-text, corpus/stress | line-height |
| pseudo-elements | ::before/::after content | yes | corpus/pseudo-elements, corpus/stress | content |
| cascade | @media at-rule resolution | yes | corpus/media-queries, corpus/stress | @media |
| cascade | @container container queries (inline-size) | yes | corpus/media-queries | @container |
| ua-stylesheet | UA defaults at lowest cascade priority | yes | corpus/ua-styles | UA stylesheet |
| lists | list-style-type markers | yes | corpus/lists, corpus/ua-styles, corpus/stress | list-style-type |
| lists | list-style-position | yes | corpus/lists, corpus/stress | list-style-position |
| colors | hsl()/hsla() (comma + space + hue units + /alpha) | yes | corpus/colors | hsl |
| colors | modern space-separated rgb()/rgba() with /alpha | yes | corpus/colors | rgb( |
| colors | 4/8-digit hex alpha | yes | corpus/colors | hex |
| colors | full CSS named-color set | yes | corpus/colors | rebeccapurple |
| colors | currentColor in every color-consuming position | yes | corpus/colors | currentcolor |
| colors | invalid color drops the declaration (parse-error recovery) | yes | corpus/colors | parse-error recovery |
| custom properties | --* declarations parse, cascade, inherit, serialize | yes | corpus/custom-properties | var( |
| custom properties | var() fallback (nested, empty, guaranteed-invalid) | yes | corpus/custom-properties | fallback |
| custom properties | cycles / undefined refs → guaranteed-invalid, consumers drop | yes | corpus/custom-properties | guaranteed-invalid |
| custom properties | var() inside calc() and shorthands | yes | corpus/custom-properties | calc( |
| custom properties | media-scoped custom-property redefinitions | yes | corpus/custom-properties | @media |
| selectors | attribute selectors: =, word-list, hyphen-prefix, prefix, suffix, substring operators, presence | yes | corpus/selectors | ~= |
| selectors | attribute case flags i / s | yes | corpus/selectors | case-insensitive |
| selectors | combinators: descendant, > (child), + (adjacent), ~ (sibling) | yes | corpus/selectors | > |
| selectors | :not() / :is() / :where() with selector-list arguments | yes | corpus/selectors | :where( |
| selectors | :is() takes max argument specificity; :where() contributes zero | yes | corpus/selectors | :is( |
| selectors | structural + root pseudo-classes (:root, :empty, first/last/only-child, :nth-child(An+B), :nth-last-child, first/last/only-of-type, :nth-of-type) | yes | corpus/selectors-structural | :nth-child( |
| @supports | declaration conditions evaluated against the engine's real surface (unsupported → block drops, css-conditional-3 §4) | yes | corpus/supports | @supports |
| @supports | not / and / or composition with precedence and nesting; @media inside and outside @supports | yes | corpus/supports | not |
| media | mq4 range syntax in @media ((width >= 300px), two-sided (400px < width <= 800px), value-first flip, aspect-ratio/resolution ranges) | yes | corpus/media-modern | (width >= |
| media | device-capability features (hover, any-hover, pointer, any-pointer, prefers-contrast, forced-colors, color-gamut, update) as explicit environment inputs | yes | corpus/media-modern | forced-colors |
| display | display: contents box suppression — children (block/flex/grid) join the grandparent's formatting context, no box, zero rect; replaced elements compute 'none' (css-display-3 §2) | yes | corpus/display-contents | display:contents |
| sizing | aspect-ratio property — ratio-derived auto dimension on block surfaces (content-box/border-box), min/max clamping, replaced-element natural-ratio transfer with attribute hints (css-sizing-4 §5) | yes | corpus/aspect-ratio | aspect-ratio |
| positioning | position: sticky — in-flow at static position, scroll-0 constraint pass against the nearest scrollport with containing-block clamp, CB for abs descendants, z-index stacking (css-position-3 §3.6) | yes | corpus/sticky | position: sticky |
| text | forced line breaks: <br> closes the line box in every white-space mode, <wbr> is a zero-width soft wrap opportunity; empty interior lines, text-align edges, list markers (css-text-3 §5.1) | yes | corpus/br-wbr | <wbr> |
| text | word-break (break-all/keep-all) and overflow-wrap/word-wrap (break-word/anywhere incl. min-content) gating in-word break opportunities through the Pretext seam (css-text-3 §6) | yes | corpus/text-breaking | word-break:break-all |
| text | text-transform (uppercase/lowercase/capitalize UAX-29 words), text-indent (length/percentage, hanging, each-line), word-spacing (length/percentage) feeding measurement and paint (css-text-3 §2, §8) | yes | corpus/text-formatting | word-spacing |
| ua-stylesheet | nested-list rules authored with :is() (Blink html.css parity) | yes | corpus/selectors | :is(dl, ol, ul) |
| ua-stylesheet | UA defaults for modern text-level and sectioning elements — mark (yellow fill), del/s strike, ins underline, small/sub/sup smaller font-size with the Blink sub/super baseline shift, fieldset groove border + legend straddling the top border (no table layout), details block container with the summary disclosure list-item | yes | corpus/text-level-ua | disclosure-closed |
| form controls | default rendering of input/select/textarea/button: UA display/box-sizing/border/background/padding and the 13.3333px control font, size/cols-derived control sizing, checkbox/radio 13x13 geometry painted per checked state, select chosen-option text + chevron, theme-painted appearance:auto look, static :checked/:disabled/:enabled matching from attributes | yes | corpus/form-controls | :checked |
| tables | table formatting context, separate-borders model (css-tables-3): anonymous table-row-group/row/cell generation (§2.1), auto width distribution (guess algorithm over cell min/max constraints, colspan distribution) and fixed layout (col-element + first-row widths, no column shrink — over-constrained tables grow), rowspan/colspan spanning with row block-size distribution, captions (caption-side, margins) above/below the box, border-spacing on every grid edge, cell vertical-align (middle/bottom/baseline), empty-cells:hide; HTML-table stray content hoists above the box, css display:table wraps stray content in place | yes | corpus/tables | table-layout |
| tables | border-collapse:collapse (css-tables-3 §4): per-edge conflict resolution over cell/row/row-group/column/colgroup/table borders (hidden first, then width, then style rank with inset→ridge / outset→groove, then the cell > row > row-group > column > colgroup > table source order), collapsed cell borders as half-insets with rects abutting and borders painted centered on the grid line, the table's border strut with padding ignored and border-radius ignored, cells stretching to their column | yes | corpus/tables-collapse | border-collapse:collapse |

### Deferred / Not in v1 (no silent absence)

Every implemented-but-unclaimed property above the row set is claimed with its
own row and corpus token. The following absent surfaces are recorded **here** so
omission is explicit, never silent (the coverage-matrix reconcile ledger,
`docs/ledgers/coverage-matrix.md`, cross-references each to the archive-audit
classification). `scripts/check-charter.mjs` parses this table and fails on
drift: an `absent` row's token must not appear in the engine source, and a
`declared-divergence` row's token must appear there and cite its ledger doc.
The first backtick token in the Absent surface column is the check token.

| Absent surface | Status | Evidence |
| --- | --- | --- |
| tables collapsing-borders model (`border-collapse`) | declared-divergence | implemented (charter §11 tables row, `corpus/tables-collapse/`, `docs/ledgers/tables.md`): both border models coexist; the separate model owns the tables-layout corpus. Chrome's exact width accounting for `hidden` borders in multi-row conflict tables (Blink merges the hidden winner yet lays the cell against the neighbor's width through column stretching) is reproduced and corpus-gated. |
| Cascade layers / !important (`@layer`) | absent | intentionally **not supported by design** (not a gap): `!important` and `@layer` are excluded from the compatibility surface because they override the normal cascade in ways a deterministic renderer must not silently accept; `cascade-layers-important` archived EMPTY. |
| @import / @font-face / @keyframes (`@import`) | absent | not parsed; `parse-stylesheets` is archived PARTIAL (the stylesheet parser explicitly skips these at-rules). |
| @supports selector() / font-tech() / font-format() conditions (`font-tech(`) | absent | not evaluated (general-enclosed → false). Declaration conditions over features Chrome supports but this engine lacks (e.g. filter) evaluate false here: the engine cannot truthfully honor the queried declaration, so such blocks drop where Chrome applies them (see `docs/ledgers/supports.md` and the decl-conditions fixture note). |
| @container `block-size`/`size` containment | declared-divergence | `container-type: inline-size` is implemented (charter row above); the full `size` and `block-size` containment values parse but establish no container in v1 (`docs/ledgers/media-queries.md`). |
| Legacy HTML elements and legacy CSS (`marquee`) | absent | intentionally **not supported by design** (not a gap): deprecated elements (`center`, `tt`, `dir`, `menu`, `font`, `marquee`, `big`, `blink`, `strike`, `plaintext`, `xmp`, `nobr`), presentational attributes, and vendor-prefixed properties get no UA rules and render as generic boxes. The engine intentionally diverges from Chrome here — a declared typed gap on `corpus/legacy-removal` — and the exclusions are stated in the README and `docs/ledgers/legacy-removal.md`. Modern-only syntax is the target; legacy comma `rgb()/rgba()` remains supported (current usage, not treated as legacy). |
