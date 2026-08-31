---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern, tables-layout]
---

# Task: Table border-collapse: collapse model and border conflict resolution

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Follow-on to tables-layout: border-collapse: collapse is the second table border model (css-tables-3 §4) — the one legacy HTML tables use by default in most real markup and the one Chrome renders with shared (collapsed) borders between cells. The tables-layout slice lands only border-collapse: separate. This slice adds the collapse model: border conflict resolution, collapsed cell borders replacing the 2px UA separate borders, and border-radius on the table box.

## Requirements

- [ ] border-collapse: collapse makes adjacent cells share borders per css-tables-3 §4: cell borders resolve by conflict resolution (border-width, then border-style, then source order) into single shared borders matching Chrome's raster.
- [ ] Collapsed borders remove the per-cell border-spacing gap and the UA separate-borders rendering, and the table border box reflects the collapsed model per Chrome's rects.
- [ ] border-collapse: collapse and separate coexist — a fixture can switch between them and both match Chrome.
- [ ] Cell/column/row/table border contributions resolve per the spec's precedence rules (cell > row > column-group > column > table), not by painting order.
- [ ] Corpus under corpus/tables-collapse/ exercises a bordered 2x2 table, unequal widths/styles between neighbors (conflict resolution), and a table with a border; verify script scripts/verify-tables-collapse.mjs compares rects, computed styles, and non-text paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-tables-collapse.mjs exits 0 — collapsed-border fixtures' rects and non-text paint match Chrome within tolerance, and conflict-resolution cases match Chrome's raster. The tables-layout corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement the collapse model inside the tables-layout slice — this slice owns it; the two border models must coexist cleanly.
- Do not approximate the conflict-resolution algorithm — cell/row/column/table borders resolve per css-tables-3 §4.2 (width precedence, style precedence, source order), gated against Chrome's raster.
- Do not regress the separate model or the tables-layout corpus.
- Do not claim border-radius on the collapsed table unless a fixture proves Chrome parity — record the radius-on-collapse raster as a declared divergence if not reproduced.
- Do not let collapsed borders affect the rect contract differently than Chrome (border widths still count in the border box).
