# Coverage Matrix Reconcile Ledger

Reconciles the charter §11 coverage matrix against what the engine actually
implements. The disease: check-charter enforces the matrix only over rows that
exist, so a feature whose archive landed no code (or never landed) simply has no
row and omission is silent. This ledger is the diff — every property the engine
resolves (`src/layout/css.ts` computed-style + `src/layout/computed-style.ts`)
or paints (`src/layout/paint.ts`) is either claimed by a matrix row backed by a
corpus token, or explicitly recorded deferred below. Nothing is silently absent.

## Method

1. Extracted the property surface from `css.ts` (`parseDeclarationBlock` /
   `makeStyle` decl lookups), `computed-style.ts` (the `computedStyleString`
   cases — the layer-2 getComputedStyle-comparable set), and `paint.ts` (bg /
   border / text-decoration / list-marker paint ops).
2. Diffed against the §11 rows (feature, property, token).
3. Every implemented-but-unclaimed gap became either a new matrix row (token
   present in `src/**/*.ts` **and** in a fixture under the listed `corpus/` dir —
   check-charter enforces both) or an explicit deferred entry.
4. Checked claimed-but-absent rows: every pre-existing row's token was confirmed
   in both source and corpus before and after the change (check-charter exit 0).

## Implemented but unclaimed → now claimed

| Feature | Property added | Row token | Corpus owning the token |
| --- | --- | --- | --- |
| grid | grid-template-areas | grid-template-areas | corpus/grid (areas) |
| grid | placement (grid-area/grid-column/grid-row, line names) | grid-area | corpus/grid |
| grid | auto / implicit tracks | grid-auto-columns | corpus/grid (implicit-tracks) |
| grid | item self-alignment (justify-self/align-self) | justify-self | corpus/grid (alignment-items) |
| block/inline | border (width/style/color, incl. inset/outset lighting) | border | corpus/spine, corpus/flexbox (padding-border), corpus/border-radius |
| block/inline | border-radius (shorthand + per-corner longhands) | border-radius | corpus/border-radius |
| block/inline | background-color (and `background` shorthand) | background-color | corpus/spine, corpus/border-radius |
| block/inline | clear | clear | corpus/floats (clear-*) |
| block/inline | inline-block (shrink-to-fit, baseline) | inline-block | corpus/inline-block |
| block/inline | vertical-align | vertical-align | corpus/inline-block |
| block/inline | min/max width/height | min-width | corpus/flexbox (min-max) |
| block/inline | overflow (hidden clip / BFC) | overflow | corpus/border-radius (overflow-clip), corpus/flexbox |
| text | text-align (incl. justify per-line) | text-align | corpus/text-align |
| text | color (foreground fill) | color | corpus/paint-text, corpus/spine |
| font | font-size | font-size | corpus/paint-text, corpus/spine |
| font | font-weight / font-style | font-weight | corpus/ua-styles |
| font | line-height | line-height | corpus/spine, corpus/paint-text |
| pseudo-elements | ::before/::after content | content | corpus/pseudo-elements |
| cascade | @media at-rule resolution | @media | corpus/media-queries |
| paint | background-image gradients (linear/radial, stops, repeating) | linear-gradient | corpus/backgrounds |
| paint | background layers (size/position/repeat/clip/origin, full shorthand) | background-clip | corpus/backgrounds |

Remaining spread-over-rows properties are claimed by a feature row rather than a
literal row: `display` by the flex/grid/inline-block/lists rows; `top/right/
bottom/left` by the `block/inline · position` row (corpus/positioning);
`text-decoration-color/thickness/text-underline-offset` by the `text ·
text-decoration` row; side/block/inline margin and padding longhands by the
`margin`/`padding` rows; grid line longhands (`grid-column-start`…) by the
`placement` row; radius longhands by the `border-radius` row; the `font` and
`background` shorthands by the `font-size`/`background-color` rows; em/vw/vh
units are length resolution inside the length properties, not separate
properties. None is a silent absence — each is an explicit disposition.

## Claimed but absent

**None.** Every pre-existing §11 row's token is present in `src/**/*.ts` and in
a fixture under its listed corpus dir (check-charter verified exit 0). The
archive-audit cross-reference already asserts this for the non-landed archives
("§11 rows … are all backed by landed work").

## Deferred / not in v1 (explicit absence)

Charter §11 — *Deferred / Not in v1* records these as a machine-checked table
(`scripts/check-charter.mjs` fails on drift); each row below mirrors the charter
row and adds the archive-audit classification so a reader can see the evidence.
Surfaces previously listed here as EMPTY/never-landed are now claimed by §11
matrix rows with corpus tokens and are no longer deferred — per-element opacity
(§11 `opacity`, `corpus/opacity`), box-shadow/text-shadow (§11 `box-shadow`/
`text-shadow`, `corpus/box-shadow`), calc()/min()/max()/clamp() (§11
value-functions rows, `corpus/calc`), custom properties/var() (§11
custom-properties rows, `corpus/custom-properties`), @supports declaration
conditions (§11 `@supports` rows, `corpus/supports`), @container container
queries (§11 `@container` row, `corpus/media-queries`), and the
collapsing-borders model (landed via `tables-border-collapse`).

| Absent surface | Charter status | Archive-audit classification | Evidence |
| --- | --- | --- | --- |
| url() raster backgrounds (image decode) | chartered-out — declared in the §11 `background-layers` row, parsed + serialized, never painted | explicit disposition, `docs/ledgers/backgrounds.md` | `corpus/backgrounds/url-unsupported` pins the contract |
| tables collapsing-borders model (`border-collapse`) | declared-divergence | `tables-layout` PARTIAL → landed via `tables-border-collapse` | `corpus/tables-collapse/`, `docs/ledgers/tables.md` |
| Cascade layers / !important (`@layer`) | absent | `cascade-layers-important` EMPTY | none |
| @import / @font-face / @keyframes (`@import`) | absent | `parse-stylesheets` PARTIAL | none |
| @supports selector() / font-tech() / font-format() conditions (`font-tech(`) | absent | `supports-at-rule` EXECUTED (declaration conditions + not/and/or) | `docs/ledgers/supports.md` |
| @container `block-size`/`size` containment | declared-divergence | `cascade-media-queries` EXECUTED, gap in ledger | `docs/ledgers/media-queries.md` |
| Legacy HTML elements and legacy CSS (`marquee`) | absent | modern-compat legacy-removal policy (not an archived task) | `docs/ledgers/legacy-removal.md`; typed gaps on `corpus/legacy-removal/legacy-elements` |

The table CSS 2.1 §17 properties (border-collapse, border-spacing, caption-side,
table-layout, empty-cells) previously had no layout effect; the tables-layout
slice landed the separate-borders model (auto/fixed layout, anonymous boxes,
spanning, captions, border-spacing, empty-cells) with corpus/tables/ and a
charter §11 row. `border-collapse: collapse` then landed via
`tables-border-collapse` (corpus/tables-collapse/) — it stays listed above as a
`declared-divergence` because the charter records the exact width-accounting
behavior it reproduces (Blink merges the hidden winner yet lays the cell against
the neighbor's width) as a corpus-gated, ledger-documented claim.

## Agreement with archive-audit.md

- Every EXECUTED archive whose feature is engine-facing maps to a matrix row with
  a corpus token: border-radius-paint → `border-radius`; text-align-inline →
  `text-align`; inline-block-layout → `inline-block`/`vertical-align`;
  pseudo-elements-content → `content`; cascade-media-queries → `@media`;
  layout-grid (+ the grid corpora) → the grid rows; paint-text → `color`,
  `font-size`, `line-height`, `text-decoration`.
- Every EMPTY/PARTIAL archive is either recorded deferred above with the audit's
  exact classification (cascade-layers-important, parse-stylesheets) or — where
  its owning task later landed — claimed by a §11 matrix row with its corpus
  token: opacity-compositing → `opacity` (corpus/opacity),
  box-shadow-paint → `box-shadow`/`text-shadow` (corpus/box-shadow),
  cascade-custom-props → the custom-properties rows (corpus/custom-properties),
  tables-layout → the tables rows (corpus/tables, corpus/tables-collapse); the
  calc()/min()/max()/clamp() surface is claimed by the value-functions rows
  (corpus/calc) and @supports by the @supports rows (corpus/supports).
  `text-font-fallback`'s non-local machinery is instead covered by
  cross-family/firefox-track as the audit notes. The paint-shapes outline
  portion left the deferral list when its owning task landed (charter §11 row
  `outline`, docs/ledgers/outline.md). No EMPTY archive is claimed
  as implemented, and no implemented feature is left without a row or a deferral.

## Verification

- `node scripts/check-charter.mjs` → **exit 0** after this amendment (105 §11
  data rows well-formed — the count check-charter prints at HEAD; every
  `Implemented: yes` token found in `src/**/*.ts`; every `Tested` corpus dir
  exists and a fixture under it exercises the token; the 6 Deferred rows
  enforced — `absent` tokens absent from src, `declared-divergence` tokens
  present with a cited `docs/ledgers/*.md` doc).
- Enforcement seam proven live, not assumed: injecting a row with a token absent
  from `src/`, a nonexistent corpus dir, or a real corpus dir whose fixtures
  don't exercise the token each made check-charter exit 1; the injected rows were
  then reverted. The Deferred enforcement was likewise proven live at this
  amendment: flipping the `border-collapse` row to `absent` (its token is
  present in src) and flipping the `@import` row to `declared-divergence` (its
  token is absent from src) each made check-charter exit 1; both flips were
  then reverted. The seam now covers the newly claimed surface, so a fixture that
  stops exercising a claimed property (or a corpus dir that disappears) fails
  loudly instead of narrowing the matrix silently.