---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: @supports at-rule parsing and evaluation

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The stylesheet parser (src/cascade/stylesheet.ts) explicitly skips @supports with brace-aware recovery (line 11: "@import, @font-face, @supports, @keyframes, ... are skipped"). @supports is spec-current and non-legacy, and it gates progressive enhancement in real documents. css-conditional-3 defines declaration conditions (property: value) plus not/and/or composition. This slice parses and evaluates @supports so supported blocks apply and unsupported blocks are dropped, matching Chrome.

## Requirements

- [ ] @supports (property: value) declaration conditions parse and evaluate against the engine's actually-supported property/value surface, so a block for an unsupported feature is dropped and a supported one applies — matching Chrome's rule-application decisions.
- [ ] not, and, and or compose conditions with correct precedence and parenthesization per css-conditional-3 §4.1.
- [ ] The shorthand forms match Chrome's support semantics (a shorthand condition is true when all its component longhands are supported, e.g. @supports (background: ...)).
- [ ] @supports nests inside @media and @media nests inside @supports with the existing flattening preserved.
- [ ] Corpus under corpus/supports/ exercises a supported condition, an unsupported condition (feature the engine lacks, e.g. a filter property), a not() case, and a nested media/supports case; verify script scripts/verify-supports.mjs compares computed styles against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-supports.mjs exits 0 — rules inside @supports blocks apply/drop identically to Chrome across the fixture set (computed styles match exactly). Existing media-queries corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not evaluate @supports with feature queries the engine cannot truthfully answer — a condition over a property/feature the engine does not support must evaluate false (that is the point of the query).
- Do not include selector() or font-tech()/font-format() conditions unless a fixture proves the engine's evaluation matches Chrome — scope to declaration conditions and document the rest.
- Do not regress the existing @media/@container parsing (the at-rule flattening must keep working alongside @supports nesting).
- Do not silently apply the content of an unsupported @supports block — the block must be dropped entirely like Chrome.
- Do not implement !important while threading @supports through the cascade.
