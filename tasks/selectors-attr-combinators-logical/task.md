---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Attribute selectors, sibling combinators, and :not()/:is()/:where()

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

src/cascade/selector.ts supports only type/id/class/universal, descendant and child combinators, and ::before/::after. Attribute selectors are skipped (brackets are consumed and discarded at selector.ts:81), sibling combinators are unknown, and :not()/:is()/:where() are not parsed. Real stylesheets use these everywhere, and the UA stylesheet currently expands :is() selectors into cartesian descendant pairs (src/cascade/ua.ts:59) as a workaround. This slice is the highest-coverage-win selector expansion in the compatibility program.

## Requirements

- [ ] Attribute selectors match per CSS Selectors §6.3: presence [attr], exact [attr=v], whitespace-token [attr~=v], hyphen-prefix [attr|=v], prefix [attr^=v], suffix [attr$=v], substring [attr*=v], with case-insensitivity i flag and case-sensitivity s flag.
- [ ] Sibling combinators parse and match: adjacent + and general ~ (Selectors §8.3.2).
- [ ] :not() matches the negation of its argument selector list and its specificity is the argument's (Selectors §3.2).
- [ ] :is() matches any of its argument selectors and takes the maximum specificity of its arguments; :where() matches identically but contributes zero specificity.
- [ ] Selector lists inside :not()/:is()/:where() parse with balanced-paren handling (nested parens, quoted strings, attribute brackets survive).
- [ ] The UA stylesheet is rewritten to use :is() directly instead of the expanded descendant-pair rules (src/cascade/ua.ts) where it genuinely simplifies.
- [ ] Corpus under corpus/selectors/ exercises every operator/combinator/functional form; a verify script scripts/verify-selectors.mjs compares computed-style results against Chrome and is wired into package.json; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-selectors.mjs exits 0 — each selector form in corpus/selectors/ matches the same elements as Chrome (computed-style exact equality on targeted properties). Existing selector corpora (ua-styles, pseudo-elements, media-queries) stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement interaction/state pseudo-classes (:hover, :focus, :active, :visited, :link, :checked, :disabled) here — they belong to the structural/state slice or the form-controls slice.
- Do not weaken specificity computation — :is() takes the max specificity of its arguments, :where() contributes zero, and :not() contributes its argument's specificity (CSS Selectors §3.2).
- Do not skip attribute selector operator combinations — [attr], [attr=v], [attr~=v], [attr|=v], [attr^=v], [attr$=v], [attr*=v] plus the i/s flags must all match per Selectors §6.3.
- Do not regress the existing type/id/class/descendant/child/::before/::after surface — existing corpora must stay green.
- Do not hand-expand :is() in the UA stylesheet anymore once the matcher supports it — replace the descendant-pair hacks with the real selectors.
