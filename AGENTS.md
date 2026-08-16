# AGENTS.md

## Comment policy

Comments explain **why**, never **what**. The code is the source of truth for what it does.

- **Write no what-comments.** Do not restate a signature, a field's meaning, a variable, or the code that follows it. A JSDoc line like `/** inherited font-weight. */` or `/** the width of the box. */` is a what-comment — omit it.
- **No JSDoc that merely restates a signature.** JSDoc is reserved for non-obvious facts about a function/type (spec cross-references, invariants, workarounds, caller contracts). If the only thing you could write is what the signature already says, write nothing.
- **Write why-comments when they earn their place:** rationale and design decisions, spec cross-references (e.g. "CSS 2.1 §8", "css-flexbox-1 §8.3.1"), Chrome/Blink/Gecko/WebKit behavior being mirrored, workarounds, and non-obvious invariants (e.g. "this module must stay float-agnostic").
- **No section banners that only name a section** (`// --- oracle quantities ---`). A banner earns its place only if it carries a why (a spec ref, a rationale clause).
- Applies to `src/`, `scripts/`, and `probes/`. Comments in `corpus/` fixtures and `docs/` are data and ledgers, not code comments — leave them alone.
