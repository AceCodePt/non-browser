---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Table layout: formatting context, auto/fixed width, spanning, caption, border-collapse separate

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The largest declared-deferred surface: charter §3 and §11 keep tables out of v1, archive/tables-layout is PARTIAL (display values parsed + UA defaults landed, no layout module). The engine computes display: table*/table-caption and the table properties (border-collapse, border-spacing, caption-side, table-layout, empty-cells) but treats table elements as generic blocks. Real documents use tables for tabular data (and legacy layouts). css-tables-3 defines the box model. This slice lands the table formatting model with border-collapse: separate (the collapse model is a follow-on slice).

## Requirements

- [ ] Table display values drive a real table formatting context: anonymous table-row-group/row/cell boxes generate where Chrome generates them (css-tables-3 §2.1).
- [ ] The auto table layout algorithm sizes columns from cell content (min/max content contributions) and the table width from column sums, matching Chrome's rects within tolerance; table-layout: fixed uses the specified column widths instead.
- [ ] Cells lay out as table cells with vertical-align (baseline/middle/top/bottom), cell padding (UA 1px + border-spacing gaps), and rowspan/colspan spanning, matching Chrome's rects.
- [ ] table-caption renders above/below the table per caption-side with Chrome's placement.
- [ ] The existing table properties stay computed (border-collapse: separate, border-spacing) and now have layout effect for the separate model.
- [ ] Corpus under corpus/tables/ exercises a plain 2x2 table, a table with column widths, a colspan/rowspan case, a caption, and a table-layout: fixed case; verify script scripts/verify-tables.mjs compares rects, computed styles, and non-text paint against Chrome; a charter §11 row with a corpus token is added.
- [ ] The charter §3/§11 'tables out of v1' claim is amended to 'tables auto layout implemented; border-collapse: collapse is the follow-on', and archive-audit's tables-layout PARTIAL is resolved.

## Verification

npm run build passes. node scripts/verify-tables.mjs exits 0 — every fixture's cell/row/table rects and computed styles match Chrome within tolerance and non-text paint is within the pixel band. Existing corpora stay green. node scripts/check-charter.mjs exits 0 with the amended tables claim.

## Prohibited Patterns

- Do not implement border-collapse: collapse in this slice — it is the follow-on tables-border-collapse slice; only the separate model (border-spacing) is in scope here.
- Do not add legacy table presentational attributes (cellpadding, cellspacing, align, bgcolor, width/height on table/cells) as styling — modern CSS properties only.
- Do not skip anonymous box generation — a <table> whose children are not table-row-groups must generate the anonymous boxes Chrome generates (css-tables-3 §2.1).
- Do not regress existing block/flex/grid layout while adding the table formatting context.
- Do not ignore caption-side — table-caption must lay out above or below the table per the computed value.
