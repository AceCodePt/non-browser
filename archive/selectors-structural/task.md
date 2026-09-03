---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern, selectors-attr-combinators-logical]
---

# Task: Structural and root pseudo-classes (:root, :empty, :first/nth-child, :nth-of-type)

## Metadata

- **Complexity:** Medium
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

The selector matcher (src/cascade/selector.ts) has type/id/class/universal/descendant/child and functional :not()/:is()/:where() after the attr-combinators-logical slice, but no structural or root pseudo-classes. Real stylesheets rely on :root, :empty, :first-child, :nth-child, and :nth-of-type for common patterns. Interaction pseudo-classes (:hover, :focus, :active, :visited) are meaningless in a static renderer and are deliberately excluded from the whole compatibility program; :checked/:disabled/:enabled are static states that belong to the form-controls slice.

## Requirements

- [ ] Structural and root pseudo-classes match per CSS Selectors: :root, :empty, :first-child, :last-child, :only-child, :nth-child(An+B), :nth-last-child(An+B), :first-of-type, :last-of-type, :only-of-type, :nth-of-type(An+B), :nth-last-of-type(An+B).
- [ ] The An+B grammar parses correctly including odd/even keywords, negative An, and the +B/-B forms; invalid An+B values make the selector fail to match (parse-error recovery).
- [ ] :empty matches elements with no children other than comments (Selectors §6.6.7) — text nodes, including whitespace, make it non-empty.
- [ ] Pseudo-classes compose with the existing compound/functional selector machinery (can combine with classes, ids, attribute selectors, and :is()/:where()/:not() lists).
- [ ] Corpus under corpus/selectors-structural/ exercises each structural pseudo-class (including nested and sibling-position cases); verify script scripts/verify-selectors-structural.mjs compares against Chrome and is wired into package.json; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-selectors-structural.mjs exits 0 — computed-style results for every structural pseudo-case match Chrome's exactly. The dependency slice's corpus stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement interaction pseudo-classes (:hover, :focus, :active, :visited, :focus-within, :focus-visible) — a static renderer has no interaction state; they are excluded by design across the program.
- Do not implement :checked, :disabled, :enabled, :required, :placeholder-shown here — they are form-control state and belong to the form-controls slice.
- Do not implement :has() here — it is a separate selector-feature decision, not part of this slice.
- Do not break the An+B parsing edge cases — :nth-child(2n+1), :nth-child(-n+3), :nth-child(odd/even), and :nth-child(0n+1) must all behave per Selectors §6.5.
- Do not weaken the type/class/attr selector surface landed by the dependency slice.
