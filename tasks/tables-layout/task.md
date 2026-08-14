---
wait_human_start: false
wait_human_merge: false
dependencies: [inline-block-layout]
---

# Task: Tables-Layout

## Metadata

- **Complexity:** High
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

95%+ browser parity push. HTML tables are common for tabular data, and the engine has zero table support: the display union (src/layout/css.ts:135) is 'block'|'none'|'grid'|'inline-grid'|'flex' with no table values, and <table>/<tr>/<td> are just parsed as generic elements. Real pages with <table> render wrong at every layer. Tables are one of the most intricate parts of CSS (anonymous box fixing, border-collapse, caption, cell spanning), so this is a high-complexity vertical slice.

## Requirements

- [ ] display values table, inline-table, table-row, table-cell, table-header-group/footer-group/row-group parsed and routed to table layout instead of block layout
- [ ] A <table> with <tr>/<td>/<th> lays out as a grid of cells with column widths matching Chrome (auto table layout; percentage and fixed widths where cheap), rects within 0.5px
- [ ] border-collapse:collapse and border-collapse:separate both supported with cell/table borders matching Chrome's rendering
- [ ] Anonymous table boxes: stray text/block content inside a table is wrapped in an anonymous row/cell as the CSS table model requires
- [ ] Cell alignment (vertical-align on cells, text-align inheritance) and cell padding follow Chrome
- [ ] Corpus corpus/tables/ with four-layer fixtures (simple table, headers, collapsed borders, colspan, nested table, percent widths) and npm run verify:tables exiting 0 against Chrome per charter §2
- [ ] Screenshot layer compares non-text regions per the current mask/tier policy

## Verification

npm run build passes. npm run verify:tables exits 0: table cell rects match Chrome within 0.5px, computed styles exact, collapsed-border rendering matches in the screenshot band, colspan/rowspan fixtures lay out as Chrome does. Existing verify scripts remain green.

## Prohibited Patterns

- Do not render <table> children as plain block boxes - rows and cells must participate in table layout with anonymous boxes for stray content
- Do not skip border-collapse (collapse vs separate) - it changes widths and border rendering materially
- Do not ignore row/column spanning (rowspan/colspan) when laying cells out
