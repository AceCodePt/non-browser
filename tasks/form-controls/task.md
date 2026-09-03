---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Default form-control rendering (input/select/textarea/button) + static-state pseudo-classes

## Metadata

- **Complexity:** Medium
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Form controls have no default rendering in the engine: input/select/textarea/button default to generic block (defaultDisplayFor, block-inline.ts:82) with no UA border, padding, background, or font — Chrome defaults them to inline-block with 2px inset borders, white backgrounds, and control-specific sizing. The stress corpus only passes today because its form fixture styles every input explicitly. This slice lands Chrome's UA rendering for form controls: correct display, control borders/backgrounds, checkbox/radio geometry, and the static state pseudo-classes (:checked, :disabled, :enabled) that control how they paint. Interaction (focus, hover, click) is excluded by the program.

## Requirements

- [ ] UA defaults give input/select/textarea/button the display and box Chrome gives them: inline-block (except input[type=hidden] → none), 2px inset border, white/control background, and padding, matching computed-style strings and rects against the oracle.
- [ ] text inputs (text, search, password, email, number) render as boxes with Chrome's default border/background; checkbox and radio render as geometric control boxes (square / circle) at Chrome's default size, painted per their checked state.
- [ ] textarea and select render as boxes with Chrome's default borders and sizing; select shows its chosen-option text (the first option) at Chrome's default.
- [ ] button/input[type=button]/submit/reset render with Chrome's default button face (2px outset border, gray background) and the label text centered.
- [ ] :checked, :disabled, and :enabled pseudo-classes match statically from the element's attributes (checked/disabled present) and change the painted state per Chrome (e.g. disabled controls paint with Chrome's disabled look).
- [ ] Corpus under corpus/form-controls/ covers text input, checkbox, radio, button, textarea, select, hidden input, and a disabled control, all with UA-default (unstyled) markup; verify script scripts/verify-form-controls.mjs compares computed styles, rects, and non-text paint against Chrome; a charter §11 row with a corpus token is added.
- [ ] docs/ledgers note records placeholder text and interaction as out of scope for a static renderer.

## Verification

npm run build passes. node scripts/verify-form-controls.mjs exits 0 — each control's computed styles and rects match Chrome within tolerance and non-text paint is within the pixel band. corpus/stress form fixture stays green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not implement interaction behavior (focus, hover, active, value input, dropdown opening) — the renderer is static; only the default appearance and static-state painting are in scope.
- Do not implement :placeholder-shown or placeholder text rendering unless a fixture proves Chrome parity — otherwise document placeholder as out of scope in the ledger.
- Do not change the display of input[type=hidden] — it must stay display:none like Chrome.
- Do not regress the explicitly-styled form fixtures in corpus/stress — styled controls must still win over the new UA defaults.
- Do not add form-control styles that diverge from Chrome's html.css (e.g. wrong default font — match the registered font resolution Chrome produces for form controls).
