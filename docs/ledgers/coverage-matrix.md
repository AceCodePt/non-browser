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

Charter §11 — *Deferred / Not in v1* records these; each is cross-referenced to
the archive-audit classification so a reader can see the evidence:

| Absent surface | Status | Archive-audit classification | Owner / successor |
| --- | --- | --- | --- |
| per-element opacity (box-level compositing) | EMPTY archive | `opacity-compositing` EMPTY | `tasks/opacity-subtree-compositing` |
| box-shadow / text-shadow | EMPTY archive | `box-shadow-paint` EMPTY | `tasks/shadow-paint` |
| outline | never landed | `paint-shapes` PARTIAL (outline ownerless) | none |
| tables layout (cell grid, border-collapse box model, spanning) | parse + UA defaults only | `tables-layout` PARTIAL; charter §3 out of v1 | none |
| calc()/min()/max()/clamp() | never landed | not an archived task | `tasks/calc-values` |
| custom properties / var() | EMPTY archive | `cascade-custom-props` EMPTY | none |
| cascade layers / !important | EMPTY archive | `cascade-layers-important` EMPTY | none |
| @import / @supports / @font-face | at-rules skipped | `parse-stylesheets` PARTIAL | none |
| @container container queries | declared typed gap | `cascade-media-queries` EXECUTED, gap in ledger | `docs/ledgers/media-queries.md` |

The table CSS 2.1 §17 properties (border-collapse, border-spacing, caption-side,
table-layout, empty-cells) are parsed and computed (getComputedStyle strings
work on table elements) but have no layout effect, so they are **not** claimed
as implemented rows (no corpus fixture exercises them; §11 "no claim without a
corpus token") — the tables-layout bullet captures that split explicitly.

## Agreement with archive-audit.md

- Every EXECUTED archive whose feature is engine-facing maps to a matrix row with
  a corpus token: border-radius-paint → `border-radius`; text-align-inline →
  `text-align`; inline-block-layout → `inline-block`/`vertical-align`;
  pseudo-elements-content → `content`; cascade-media-queries → `@media`;
  layout-grid (+ the grid corpora) → the grid rows; paint-text → `color`,
  `font-size`, `line-height`, `text-decoration`.
- Every EMPTY/PARTIAL archive is recorded deferred above with the audit's exact
  classification (box-shadow-paint, opacity-compositing, tables-layout,
  paint-shapes/outline, cascade-custom-props, cascade-layers-important,
  parse-stylesheets, text-font-fallback's non-local machinery is instead covered
  by cross-family/firefox-track as the audit notes). No EMPTY archive is claimed
  as implemented, and no implemented feature is left without a row or a deferral.

## Verification

- `node scripts/check-charter.mjs` → **exit 0** after the amendment (all 53
  rows well-formed; every `Implemented: yes` token found in `src/**/*.ts`; every
  `Tested` corpus dir exists and a fixture under it exercises the token).
- Enforcement seam proven live, not assumed: injecting a row with a token absent
  from `src/`, a nonexistent corpus dir, or a real corpus dir whose fixtures
  don't exercise the token each made check-charter exit 1; the injected rows were
  then reverted. The seam now covers the newly claimed surface, so a fixture that
  stops exercising a claimed property (or a corpus dir that disappears) fails
  loudly instead of narrowing the matrix silently.