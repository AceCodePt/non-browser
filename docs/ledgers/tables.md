# Tables Ledger

Owning module: `src/layout/tables.ts` (formatting context, column model,
row/block sizing, captions, collapsed borders); wiring in
`src/layout/block-inline.ts` (`layoutElementBox` table branch, `layoutBlock`
table width + auto-margin centering, inline-table atomics, `tableDefaultsFor`);
corpus `corpus/tables/` (separate model) and `corpus/tables-collapse/`
(collapsed model); verify `scripts/verify-tables.mjs` and
`scripts/verify-tables-collapse.mjs`.

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

## Collapsed borders (`border-collapse: collapse`, css-tables-3 §4)

Ported against Blink's `TableBorders` (third_party/blink/renderer/core/layout/
table/table_borders.{h,cc}) and probed against Chrome raster
(`probes/probe-table-collapse*.mjs`):

- **Edge grid.** Every grid edge stores one winner: vertical edges per
  (row, column boundary), horizontal edges per (row boundary, column). Sources
  merge in the spec's precedence order — cells (document order), rows, row
  groups, columns, colgroups, table — and the comparison is
  `IsSourceMoreSpecificThanEdge`: an empty edge is taken; a `hidden` source
  beats everything; an existing `hidden` edge can't be beaten; then wider
  wins; then the EBorderStyle enum rank (`none < hidden < inset < groove <
  outset < ridge < dotted < dashed < solid < double`) with
  `ComputedStyle::CollapsedBorderStyle` mapping applied first, so `inset`
  compares as `ridge` and `outset` as `groove` — probed: collapsed `inset`
  beats a plain `groove` at equal width. Ties keep the earlier-merged source
  (top/left wins, css-tables-3 §4.2 rule 4).
- **Geometry.** Cell rects abut (a cell's rect edge is the border center);
  each cell's border box = content + padding + half of its four collapsed
  border widths (max paintable width per side over spanned edges); the table's
  border box = grid + the strut (half of the widest collapsed outer border on
  each side — max over ALL rows, not a first-row-only rule, probed). Rows abut
  at grid lines; row height = max(specified raw, max cell content + padding +
  top/bottom half-insets). `border-spacing` and the table's own padding are
  ignored (css-tables-3 §3.6.2; Chrome's getComputedStyle reports the table's
  used padding as 0px, mirrored in computedStyleFor).
- **Paint.** One border segment per edge, centered on the grid line and
  pixel-snapped (a 3px border at a half-pixel line covers the 3 px Chrome
  covers). Segment ends are capped by half the adjacent perpendicular border
  widths so corners fill and the outer border lands flush with the table
  rect. Chrome paints per cell in document order and the last painter wins, so
  a shared vertical edge renders in the right neighbor's orientation and a
  shared horizontal edge in the lower neighbor's — the engine paints each edge
  once with that ownership. `inset`/`outset` winners paint as
  `ridge`/`groove` (CSS 2.1 §17.6.3). The table's own border op is suppressed
  (it merged into the edges) and its background paints square.
- **Width quirks, corpus-gated.** A hidden winner suppresses the paint but the
  edge width comes from the visible candidates through the column stretch:
  cells stretch to their column (max over the column's cells of content +
  padding + insets), so in the hidden-borders fixture the hidden cell's rect
  is 124px wide while its own insets are 0 — matching Chrome exactly.
- **Coexistence.** `border-collapse: collapse` and `separate` select per
  table; all separate-model paths are untouched (corpus/tables stays green).
  `border-collapse` now inherits through the cascade (CSS 2.1 §17.6; a
  `<td>` inside a collapsed table computes `collapse` like Chrome) and
  `<col>/<colgroup>` honor the HTML `span` attribute for their column span.
- **border-radius on collapsed tables** — ignored by both engines
  (css-tables-3 §3.6.2; probed: Chrome's raster is byte-identical with and
  without radii). The basic-2x2 fixture proves the parity: it sets radii on
  the table and cells and both rasterizers output square corners within the
  §10 band. No divergence declared.

## Out of scope (follow-on slices)

- Legacy table presentational attributes (cellpadding, cellspacing, align,
  bgcolor, width/height on table parts) are not styled — modern CSS only.
- Collapsed-border fixtures stick to solid/double/dashed-style winners whose
  full-segment rendering is continuous; a collapsed `dashed`/`dotted` WINNER
  (e.g. an 8px dashed border beating a solid) is not corpus-covered — the
  segment painter reuses the separate-model pattern painters, so the phase
  origin per side is unprobed for collapsed edges.

## Verification

`npm run verify:tables` — eight fixtures under `corpus/tables/` (basic,
column-widths, spanning, caption, fixed-layout, anonymous-boxes, valign,
spacing-empty) checked in four layers against Chrome: measureText, computed
style, rects ≤ 0.5px per box dimension, screenshot ΔE ≤ 2 with ≤ 1% exceeding
(text pixels under the documented text tier). Dev parity probes live in
`probes/probe-table-*.mjs` (all await `document.fonts.ready` — earlier runs
without it produced nondeterministic font-artifact quantities).

`npm run verify:tables-collapse` — six fixtures under `corpus/tables-collapse/`
(basic-2x2, conflict-resolution, table-border, coexistence, hidden-borders,
row-col-borders) in the same four layers; the screenshot band gates the shared
border raster (centered paint, corner caps, winner styles, hidden
suppression), rects gate the collapsed box model, and the computed-style layer
gates the model flags and the used-padding zero.
