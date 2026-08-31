---
wait_human_start: true
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Custom properties and var() substitution

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Custom properties / var() are entirely absent — archive/cascade-custom-props is EMPTY (docs/ledgers/archive-audit.md:25) and no code exists. They are not legacy and not a foot-gun; they are the foundation of modern design systems (theme tokens). css-variables-1 defines: --custom-property declarations, inheritance, var(--x [, fallback]) substitution at computed-value time, and interaction with calc(). This slice lands the whole pipeline: parse → cascade (custom props participate in cascade + inherit) → var() substitution → computed-style serialization.

## Requirements

- [ ] --custom-property declarations parse, cascade (including within @media blocks), inherit, and serialize in getComputedStyle as the authored token stream matching Chrome.
- [ ] var(--name) substitutes the custom property's value at computed-value time in any property that accepts the substituted grammar (color, length, etc.), matching Chrome's computed styles.
- [ ] var(--name, fallback) uses the fallback when the variable is undefined or its substituted value is invalid at computed-value time.
- [ ] Circular references and invalid-at-computed-value declarations resolve like Chrome (declaration dropped to guaranteed-invalid; inherited value applies where inheritance applies).
- [ ] var() composes inside calc()/min()/max()/clamp() and inside shorthand values that the engine parses, with Chrome-parity computed results.
- [ ] The cascade phases (src/cascade/) carry custom-property declarations through the media/container resolution without losing them, and inline-style custom properties work.
- [ ] Corpus under corpus/custom-properties/ exercises inheritance, fallback, calc() interop, media-query scoping, and an invalid-at-computed-value case; verify script scripts/verify-custom-properties.mjs compares computed styles against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-custom-properties.mjs exits 0 — computed-style strings match Chrome exactly on every fixture (including inheritance, fallback, invalid-at-computed-value, and calc interop). Existing cascade corpora stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement !important (unsupported by design) even though custom properties participate in the cascade — normal-cascade-only resolution is the contract.
- Do not substitute var() at parse time — substitution is at computed-value time per css-variables-1 §3, so circular references and invalid-at-computed-value declarations resolve like Chrome (guaranteed-invalid → inherited/unset).
- Do not implement @property/registered custom properties (typed, inherits, initial-value) — that is a css-properties-values-api surface, out of scope here; only unregistered custom properties.
- Do not break the existing cascade (media queries, UA, inline styles, specificity ordering) while threading custom properties through it.
- Do not silently ignore a var() that fails — a declaration whose substituted value is invalid at computed-value time must drop to the inherited/unset behavior Chrome applies.
