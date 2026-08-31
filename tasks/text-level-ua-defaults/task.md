---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: UA defaults for modern text-level and sectioning elements

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The UA stylesheet (src/cascade/ua.ts) covers headings, p, lists, pre/code, hr, a, address — but modern text-level and sectioning elements have no default styling: mark (yellow background), del (line-through) / ins (underline), s (line-through), small (smaller font), sub/sup (subscript/superscript + smaller), abbr, q, fieldset/legend (fieldset border + legend handling), details/summary (summary block, details container). Chrome's html.css styles all of these; the engine currently treats them as generic block (or inline) boxes. This is the element×CSS conjunction: UA defaults are how browsers render the elements themselves.

## Requirements

- [ ] UA defaults land for mark (yellow background), del (line-through), ins (underline), s (line-through), small (smaller font-size), sub/sup (vertical-align sub/super + smaller font-size), matching Chrome's html.css computed values.
- [ ] fieldset gets Chrome's default border and margin; legend participates in the fieldset box (its placement matches Chrome's rects) without needing table layout.
- [ ] details renders as a block container and summary as a block child with Chrome's default padding; the disclosure marker is either reproduced with Chrome parity or recorded as a declared divergence in a ledger.
- [ ] abbr/q are plain inline elements (no UA style beyond inline) matching Chrome where no decoration applies.
- [ ] Each element's computed styles (font-size, font-style, font-weight, text-decoration-line, background-color, vertical-align) match Chrome exactly on a corpus fixture.
- [ ] Corpus under corpus/text-level-ua/ exercises every element above; verify script scripts/verify-text-level-ua.mjs compares computed styles, rects, and non-text paint against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-text-level-ua.mjs exits 0 — computed-style strings for every element match Chrome exactly, rects are within tolerance, and non-text screenshots are within the pixel band. Existing ua-styles corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not add legacy elements to the UA sheet while adding modern ones (center/font/marquee are excluded by the program; the legacy-removal slice already removed them).
- Do not implement <q> quote insertion unless the content property can generate the quote marks — otherwise leave q as a plain inline element and document it.
- Do not add fieldset's legacy 2px inset border via a hack — match Chrome's current UA default exactly and gate it against the oracle.
- Do not implement <details>/<summary> disclosure marker (the triangle) without a corpus fixture proving Chrome parity — if the marker cannot be reproduced, record it as an intentional divergence in the ledger instead.
- Do not regress existing UA defaults (headings, p, lists, pre, hr, a) — the ua-styles corpus must stay green.
