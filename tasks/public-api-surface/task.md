---
wait_human_start: true
wait_human_merge: false
dependencies: []
---

# Task: Task: Define, document, and smoke-test the public API surface of the library

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

package.json describes an npm TypeScript library ("cascade-core") fed by @ace-code/shast renderComponent output per charter §5, but README.md is one line and the engine has no declared public entry point — src/layout/index.ts exports internals with no documented contract. Consumers cannot know the renderHtml signature, option shape, or output format. Define the public API surface, document it, and smoke-test the built package.

## Requirements

- [ ] New src/index.ts exports the public contract (renderHtml signature + option shape: HTML/CSS string input per charter §5, viewport, browser-config selection per §4, output buffer/format) and nothing internal.
- [ ] README.md documents the API: input contract (generic HTML/CSS strings or shast renderComponent output), viewport requirement, browser-config, output format, and the four-layer parity claim with the §2 tolerances.
- [ ] A smoke test (node --test) imports the built entry from dist/ and renders a minimal fixture to a buffer.
- [ ] No engine behavior change.

## Verification

npm run build passes. The smoke test passes against the public entry from dist/. README documents the input contract and output format. grep confirms src/index.ts is the only public export path — no accidental internal exports.

## Prohibited Patterns

- Do not export internals as public API — the module boundary is explicit.
- Do not change engine behavior.
- Do not add Playwright or any oracle to product dependencies (charter §7).
