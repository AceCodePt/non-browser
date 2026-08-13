---
wait_human_start: false
wait_human_merge: false
dependencies: [nonbrowser-spine]
---

# Task: Text-Font-Fallback

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Font resolution is where measurement and paint silently diverge: the oracle (Chrome) resolves fonts via system fontconfig, while the engine registers local .ttf/.woff2. For parity both must resolve to identical glyphs. Also establishes the per-browser fallback-table mechanism (chrome/firefox) that the firefox-track task will extend. Owning module text/fonts/, corpus/fonts/.

## Requirements

- [ ] Font registration pipeline: register .ttf/.woff2 into the Canvas interface (skia) by family/weight/style
- [ ] Deterministic font resolution: a CSS font shorthand/stack resolves to a concrete font file with a defined order (explicit registrations first, then per-browser fallback tables)
- [ ] Per-browser fallback tables (JSON, keyed by browser target) defining fallback order for common families/missing-glyph cases; chrome table populated in this task
- [ ] Oracle-font agreement: verify script installs the same font files for the Playwright Chrome oracle (system fontconfig) that the engine registers, and proves identical glyph selection via the layer-1 measureText comparison on fonts/ fixtures
- [ ] Fallback fixtures: text using unregistered families falls back identically in engine and oracle (same widths, same glyphs)
- [ ] docs/ledgers/fonts.md documents the fallback tables, the font set used, and any divergences

## Verification

`npm run verify:fonts` exits 0: registered-font fixtures measure identically vs Chrome, and unregistered-family fixtures fall back to the same glyphs/widths in both engine and oracle. Ledger docs/ledgers/fonts.md updated.

## Prohibited Patterns

- Do not ship a different font set to the oracle than the engine registers — parity fixtures must install the same font files system-wide
- Do not hardcode machine-specific font paths; resolution must be deterministic across machines
