# Tables Ledger

Owning module: `src/layout/tables.ts` (formatting context, column model,
row/block sizing, captions); wiring in `src/layout/block-inline.ts`
(`layoutElementBox` table branch, `layoutBlock` table width + auto-margin
centering, inline-table atomics, `tableDefaultsFor`); corpus `corpus/tables/`;
verify `scripts/verify-tables.mjs`.

## Scope

The table CSS 2.1 §17 properties parsed and computed since `abe9b9e` now have
layout effect under the **separate-borders model** (css-tables-3):

- Display values `table`/`inline-table`/`table-row-group`/`table-header-group`/
  `table-footer-group`/`table-row`/`table-cell`/`table-caption`/
  `table-column`/`table-column-group` drive the formatting context.
- Anonymous box generation (css-tables-3 §2.1): cells where rows are expected
  wrap into anonymous rows, rows where groups are expected wrap into anonymous
  row-groups, stray inline content becomes an anonymous cell. Two probed Blink
  behaviors split the stray-content rule:
  - **CSS `display:table` elements** wrap stray content into anonymous
    cell/row/row-group boxes **in place** (the stray cell participates in the
    grid).
  - **HTML table elements** (`table`/`thead`/`tbody`/`tfoot`/`tr`) **hoist**
    non-table-part children into an anonymous block above the table box. The
    hoisted block flows at the containing-block width (not the table's
    shrink-to-fit width), does not affect the table's width, and occupies the
    table's flow slot (`LayoutNode.flowExtra` carries the extra block height so
    the next sibling advances past it). The table element's rect excludes the
    hoisted content.
- Auto table layout: cell inline constraints per Blink
  `TableTypes::CreateCellInlineConstraint` (auto layout
  `resolved_min = max(min-content, css min-width)`; fixed layout
  `resolved_min = 0`; `content_max = specified ?? max-content`, clamped by
  max-width), colspan cells distributed over their span (ascending span, then
  start column), column merging per `Column::Encompass` (a constrained column
  takes a later unconstrained cell's **min** into its max), and the
  guess-based width distribution of
  `DistributeInlineSizeToComputedInlineSizeAuto` (min/percentage/specified/max/
  above-max guesses — the percentage and specified guesses accumulate **min**
  for column classes the guess does not grow).
- Fixed table layout: col-element widths override first-row cell widths;
  constrained columns never shrink — an over-constrained fixed table **grows**
  beyond its specified width (probed: spec 50px+80px in `width:100px` renders a
  130px table); autos share the remaining space equally; scale-up to the
  assignable width only when there are no auto columns.
- Rowspan/colspan spanning: cells tabulate to the first free column (skipping
  cells occupied by rowspans from earlier rows); row block sizes distribute
  rowspan excess through Blink's legacy
  `CompareRowspanCellsInHeightDistributionOrder` (enclosed spanners first, then
  lowest start row, then bigger min) and `DistributeExcessBlockSizeToRows`
  (rows with an originating rowspan equally, then unconstrained non-empty rows
  proportionally, then empty rows equally, then all non-empty rows
  proportionally).
- Captions: `caption-side` top/bottom, caption margins push the caption box in
  from both edges (caption border box = element border-box width minus its
  margins), caption **min-content** (+ margins) floors the table width
  (probed: a caption that wraps grows the table to its min, not max). Bottom
  captions stack below the table box.
- Cells: UA 1px padding, UA vertical-align middle, th bold + centered; cell
  vertical-align middle/bottom shift the content inside the spanned row
  height; baseline rows take the max first-line baseline of baseline-aligned
  cells, and a table with no baseline-aligned cells baselines by its **first
  cell's** first-line baseline (Blink `LayoutTableCell::FirstLineBaseline` —
  probed via inline-table alignment). A cell's specified height feeds the row
  minimum **raw** (probed: `td {height:80px}` with 1px padding yields an 80px
  row; the cell stretches to the row with its padding inside).
- `border-spacing` applies on **every** grid edge (first/last columns and rows
  included): cells start at content + spacing, row cursor starts one spacingV
  below the grid top. `empty-cells: hide` (inherited — the property now
  inherits through the cascade) suppresses background/border paint on empty
  cells (no element children, no non-whitespace text) while keeping their grid
  slot.
- Inline tables (`display:inline-table`) size through the same
  shrink-to-fit and align by the table baseline in line layout.

## Deliberate modeling decisions (probed against Chrome)

- **Pixel-snapped fills.** Blink's BoxPainter pixel-snaps every filled rect
  (edges rounded to the device grid separately). Fractional table columns made
  the engine's anti-aliased fills diverge from Chrome's solid columns, so
  `SkiaCanvas.fillRect` now snaps edges. Gradient fills keep geometric
  rasterization.
- **Fixed-layout column floor.** `tableGridWidths` counts only constrained
  (specified, non-percent, non-zero) columns toward the fixed table's
  min-content: auto columns never force growth — unbreakable auto content
  overflows a fixed table at its specified width (probed).
- **Caption min, not max.** A caption contributes its min-content width (plus
  margins) to both table min and max; its max-content does not stretch the
  table (probed: `Caption text` yields a 58.41px table = "Caption", wrapped to
  two lines).

## Out of scope (follow-on slices)

- `border-collapse: collapse` — a table with `collapse` still lays out under
  the separate model here; the collapsing-borders box model is the
  `tables-border-collapse` slice.
- Legacy table presentational attributes (cellpadding, cellspacing, align,
  bgcolor, width/height on table parts) are not styled — modern CSS only.

## Verification

`npm run verify:tables` — eight fixtures under `corpus/tables/` (basic,
column-widths, spanning, caption, fixed-layout, anonymous-boxes, valign,
spacing-empty) checked in four layers against Chrome: measureText, computed
style, rects ≤ 0.5px per box dimension, screenshot ΔE ≤ 2 with ≤ 1% exceeding
(text pixels under the documented text tier). Dev parity probes live in
`probes/probe-table-*.mjs` (all await `document.fonts.ready` — earlier runs
without it produced nondeterministic font-artifact quantities).
