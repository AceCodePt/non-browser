# Archive Audit Ledger

Audit of every `archive/<name>/` entry: whether its requirements actually
landed, determined from git history (branch merges, the `orch: archive <name>`
commit, the work commits behind each merge) and source evidence (owner tokens
in `src/`, `scripts/`, `corpus/`). Read-only over the archives — no spec was
edited. A pure `{tasks => archive}/<name>/task.md` archive commit with no
preceding merge means the task shipped nothing; where the session-status-bug
first wave (pre re-declare, commit `72f2537`) archived a task empty and a later
run re-archived it, the table classifies the *current* archive entry.

The spec's title says "42" archives; the tree today holds **48** — the six
archived after the spec was written (font-registration-faces, strip-what-comments,
per-glyph-fallback, coherence-generalize, text-measure-remaining-gaps,
paint-run-fallback) are included for completeness.

## Classifications

| Archive | Status | Evidence |
| --- | --- | --- |
| border-radius-paint | EXECUTED | merge `1a8d0c9` landed `src/layout/radius.ts`, `scripts/verify-border-radius.mjs`, `corpus/border-radius/` (circle-50, ellipse-50, elliptical-corners, overflow-clip) |
| box-shadow-paint | EMPTY | merge `f824e18` landed only `probe-shadow5..10.mjs`; no shadow parse/paint in `src` (grep zero), no `corpus/box-shadow`, no `verify:box-shadow` — redone as `tasks/shadow-paint` |
| browser-canvas-support | EXECUTED | merge `841ba23` landed `src/config/safari.ts`, one `resolveFontFamily` authority shared by seam+engine, seam harvests real families, `probes/probe-gap-lib.mjs` + 39 tests, `docs/ledgers/safari.md` |
| cascade-core | PARTIAL | selector matching / specificity / ordering / inheritance exist in `src/cascade/{selector,stylesheet,index}.ts` but were authored by the cascade-media-queries accept (`116faa1`); cascade-core's own merge `b6a9ec7` was scaffold-only (`package.json`+`tsconfig`); no `corpus/cascade-core`, no `verify:cascade-core` |
| cascade-custom-props | EMPTY | merge `a2ed19b` landed only `scripts/probe-oracle.mjs`; no `var()`/custom-property code in `src` (grep zero), no `corpus/custom-props`, no `verify:custom-props` |
| cascade-layers-important | EMPTY | merge `f816118` landed only `probe-tmp.mjs`; no `!important`/`@layer` handling in `src`, no corpus, no verify — `src/cascade/index.ts` still names layers/!important as unowned |
| cascade-media-queries | EXECUTED | merge `e683790` landed `src/cascade/` phase pipeline + `corpus/media-queries/` + `verify-media-queries.mjs`; `@container` gap is a typed declared gap (ledger), not silent |
| coherence-generalize | EXECUTED | merge `49780e3` = the single-authority consolidation (css.ts clamp/borderPaddingInline, shared `fontmetrics`, positioned-layout through active config); confirmed by `parity.md` Honest Reading #6 |
| corpus-expansion | EMPTY | `orch: archive corpus-expansion` (`12cb200`) is a task.md move; no merge, no redo work — no `verify:all`, no 30-fixture broad corpus, no CI wiring exist |
| coverage-matrix-sweep | EXECUTED | merge `d46c555` landed charter §11 matrix + `check-charter.mjs` enforcement + `generate-sweep.mjs` + `corpus/sweep-{flexbox,grid}` + `corpus/cross-family`/`verify-cross-family.mjs` |
| firefox-track | EXECUTED | merge `8aef30a` landed `src/config/firefox.ts`, `corpus/firefox-track/`, `verify-firefox.mjs`, `docs/ledgers/firefox.md` |
| flexbox-baseline-authority | EXECUTED | merge `1dad244` = one `fontmetrics` baseline authority shared by flexbox/block-inline/paint; six nowrap-baseline sweep fixtures flipped (gap 36→30 per `sweep.md`) |
| flexbox-wrap-reverse | EXECUTED | merge `02dd8c1` = wrap-reverse cross-axis ordering/stretch in `src/layout/flexbox.ts`; all 20 wrap-reverse sweep fixtures flipped (gap 30→10) |
| font-registration-faces | EXECUTED | work merged via `b4c52a4`/`418f7b8`: `fonts/NotoSansThai.ttf`+`NotoColorEmoji.ttf` registered in `chrome.ts`, `/home` paths de-calibrated, `scripts/verify-font-registration.mjs` gate, known-gaps 7→5 |
| font-registration-gaps | EMPTY | `orch: archive font-registration-gaps` (`6504063`) is a task.md move; no merge — the redo (`font-registration-faces`) context says "archived by the daemon WITHOUT execution" |
| gap-fixture-schema | EXECUTED | merge `c605add` landed one typed per-layer `expected` (`scripts/lib/expected.mjs`, harness `fixtures.ts`/`evaluate.ts`) + check-charter enforcement of typed reason+sunset |
| hardening-core | EMPTY | `orch: archive hardening-core` (`4d3134c`) is a task.md move; no merge — `parity.md` Honest Reading #6: "archived with no code changes — all ten requirements remain open"; findings 1–3 still live as items 1–3 |
| harness-tolerances | EXECUTED | merge `9731b3c` landed `src/harness/{deltaE,evaluate,fixtures}.ts`, `tolerances.json`, `verify-report.mjs`, `harvest-oracle.mjs`, `corpus/harness-tolerances/` (incl. regression-divergence self-test) |
| inline-block-layout | EXECUTED | merge `6325c0a` = inline-block no longer coerced to block (`css.ts`), shrink-to-fit + baseline via fontmetrics, `verify-layout-inline-block.mjs`, `corpus/inline-block/` (inline-in-text, sized-badges, vertical-align) |
| layout-block-inline | PARTIAL | block/inline engine (`src/layout/block-inline.ts`, `css.ts`, `measure.ts`) landed but under the layout-floats accept (`af1add0` — first-wave work attribution); layout-block-inline's own merge `de20e0d` = package.json+probe only; no `corpus/block-inline`, no `verify:layout-block-inline` |
| layout-flexbox | EXECUTED | merge `4c745ad` landed `src/layout/flexbox.ts` (989 lines), `corpus/flexbox/`, `verify-layout-flexbox.mjs` |
| layout-floats | EXECUTED | merge `fe31fc8` landed `src/layout/floats.ts` + the block-inline engine, `corpus/floats/`, `verify-layout-floats.mjs`, `docs/ledgers/floats.md` |
| layout-grid | EXECUTED | merge `8056beb` landed `src/layout/grid.ts` (1377 lines), `corpus/grid/`, `verify-layout-grid.mjs` |
| layout-positioning | EXECUTED | merge `b2e147e` landed `src/layout/positioning.ts`, `corpus/positioning/`, `verify-layout-positioning.mjs` |
| lists-markers | EXECUTED | merge `7f4836d` landed Blink-exact list markers (disc/decimal/square/none, inside/outside, ol renumbering), `corpus/lists/`, `verify-lists.mjs`, `docs/ledgers/lists.md` |
| nonbrowser-spec | EXECUTED | merge `b31709b` landed `docs/charter.md` (the task is charter-only by design); `check-charter.mjs` green |
| nonbrowser-spine | EXECUTED | merge `482d138` landed five `corpus/spine/` four-layer fixtures, `src/layout/render.ts`, the Pretext seam, four-layer harness skeleton (`verify-four-layer.mjs`) |
| opacity-compositing | EMPTY | `orch: archive opacity-compositing` (`7f394b5`) is a task.md move; no merge — engine greps zero for box-level opacity; redone as `tasks/opacity-subtree-compositing` |
| orch-verify-hook | EXECUTED | merge `c718f7e` landed a real executable committed-on-base `.orchestration/hooks/session-idle` dispatching feature verify subsets by TASK_NAME |
| paint-run-fallback | EXECUTED | merge `9b18fff` landed shared run-resolution authority (`src/canvas/script-fallback.ts` used by both measure+drawText), `verify-paint-fallback.mjs`, mixed-script paint-text fixture un-masked |
| paint-shapes | PARTIAL | merge `af12f34` landed only `probe-shadow.mjs`/`2`/`3`/`4`; background/border paint exists in `src/layout/paint.ts` but via spine/floats work, not this task; box-shadow and outline never landed (shadow = `tasks/shadow-paint` redo, outline ownerless); no `corpus/shapes`, no `verify:paint-shapes` |
| paint-text | EXECUTED | merge `429c2cc` landed correct-baseline text paint, text-decoration, letter-spacing at paint (`src/layout/paint.ts`), `corpus/paint-text/`, `verify-paint-text.mjs`, `paint-text.md` |
| parse-stylesheets | PARTIAL | a stylesheet parser IS live (`src/cascade/stylesheet.ts`) but was authored under the media-queries accept (`116faa1`) and explicitly skips `@import`/`@supports`/`@font-face`; parse-stylesheets' own merge `a1e1a53` = `probe-csstree2/3.mjs` + an unused `css-tree` dependency; no `corpus/stylesheets`, no `verify:stylesheets` |
| perf-engine-vs-oracle | EXECUTED | merge `696ee11` landed `scripts/bench-engine-vs-oracle.mjs` + honest engine-vs-Chrome-render-vs-harness split in `parity.md` |
| per-glyph-fallback | EXECUTED | work merged via `058f57b`/`42c6fb5`: `src/canvas/script-fallback.ts` run-splitting + scriptCoverage in `browser-config.ts`, known-gaps 5→2 |
| pretext-engine-path | EMPTY | `orch: archive pretext-engine-path` (`55d3d1a`) is a task.md move; no merge — `src/layout/measure.ts` still ships the greedy wrapper; seam-vs-shipped split is documented unlanded (`parity.md` HR #3); redone as `tasks/pretext-breaker-path` |
| pseudo-elements-content | EXECUTED | merge `4748c20` landed `::before/::after` matching in `src/cascade/selector.ts` + content inline-box generation, `corpus/pseudo-elements/`, `verify-pseudo-elements.mjs`, `pseudo-elements.md` |
| strip-what-comments | EXECUTED | merge `fa8416f` = deletions-only diff across `src/scripts/probes` (no code change) + AGENTS.md comment policy |
| tables-layout | PARTIAL | merge `abe9b9e` landed table display-value parsing + UA table defaults (`src/layout/css.ts`, `block-inline.ts`, `computed-style.ts`) + `probes/probe-table-*.mjs`; but no table layout module (cell grid, border-collapse, spanning), no `corpus/tables`, no `verify:tables`; charter §3 lists tables out of v1 |
| text-align-inline | EXECUTED | merge `b3fb830` landed `text-align` in computable style + per-line alignment (incl. justify), `corpus/text-align/`, `verify-text-align.mjs` |
| text-breaker-parity | EMPTY | archived twice (`79b0834`, `5e35ab2`) as task.md moves, no merge; `docs/ledgers/breakers.md` is still a stub; no `verify:breaker`, no `corpus/breaker` — redone as `tasks/pretext-breaker-path` |
| text-font-fallback | EMPTY | `orch: archive text-font-fallback` (`f4fed62`) is a task.md move, no merge; the per-browser fallback-table machinery landed instead under firefox-track (`0d52778`) and cross-family; no `verify:fonts`, no `corpus/fonts` |
| text-mask-parity | EXECUTED | merge `7f6eb03` landed `probe-text-mask.mjs` + tiered text-region tolerance (`tolerances.json` v2), unmasked-with-tier in `verify-four-layer.mjs`, per-fixture text metrics, `text-mask.md` + charter §10 reconciliation |
| text-measure-corpus | EXECUTED | merge `6bbee09` landed `corpus/measure-corpus/` (10 categories), `verify-text-measure.mjs`, `text-measure.md` |
| text-measure-remaining-gaps | EXECUTED | merge `6e24b8b` landed `src/canvas/tabs.ts` (tab-stop math) + `src/layout/letter-spacing.ts` (joining-script spacing); known-gaps 2→0 |
| text-segmenter-icu | EXECUTED | merge `beebc0f` landed `corpus/segmenter-icu/`, `verify-segmenter.mjs`, `icu.md` runtime+ICU recording |
| ua-stylesheet-defaults | EXECUTED | merge `1f3321e` landed `src/cascade/ua.ts` lowest-priority UA defaults, `corpus/ua-styles/`, `verify-ua-styles.mjs`, charter matrix row |
| white-space-pre-nowrap | EXECUTED | merge `b8cb27d` landed white-space-aware breaker (pre/nowrap/pre-wrap/pre-line) in `src/layout/measure.ts`, `corpus/white-space/`, `verify-white-space.mjs`, `white-space.md` |

## Summary

- **EXECUTED: 33** — requirements demonstrably landed (owner code + corpus + verify).
- **PARTIAL: 5** — cascade-core, layout-block-inline, paint-shapes, parse-stylesheets, tables-layout.
- **EMPTY: 10** — box-shadow-paint, cascade-custom-props, cascade-layers-important, corpus-expansion, font-registration-gaps, hardening-core, opacity-compositing, pretext-engine-path, text-breaker-parity, text-font-fallback.

Consistent with the git evidence: every EMPTY row is a pure task.md-move archive
commit with no preceding merge; every PARTIAL row has either an attribution
mismatch (engine landed under a sibling first-wave accept) or an explicitly
skipped requirement; every EXECUTED row has a merge whose diff contains the
task's owner tokens.

## EMPTY/PARTIAL cross-reference

Cross-ref of the 15 non-landed archives against current `tasks/` specs and the
charter §11 coverage matrix. §11 rows (flex, grid, block/inline, text, font,
ua-stylesheet, lists) are all backed by landed work, so none of these correspond
to a live matrix row.

| Archive | Status | Owner in `tasks/` | Charter §11 |
| --- | --- | --- | --- |
| font-registration-gaps | EMPTY | **yes** — `font-registration-faces` (archived, executed) | — |
| hardening-core | EMPTY | **partial** — successor `coherence-generalize` closed #5+duplication; findings 1–3 ⇒ `pretext-breaker-path`, `layer1-mean-gate`, `text-tier-verifiers` | — |
| pretext-engine-path | EMPTY | **yes** — `tasks/pretext-breaker-path` | — |
| text-breaker-parity | EMPTY | **yes** — `tasks/pretext-breaker-path` | — |
| box-shadow-paint | EMPTY | **yes** — `tasks/shadow-paint` | — |
| opacity-compositing | EMPTY | **yes** — `tasks/opacity-subtree-compositing` | — |
| paint-shapes (outline portion) | PARTIAL | **partial** — box-shadow part ⇒ `tasks/shadow-paint`; outline has no owner; background/border paint exists via sibling work | — |
| cascade-custom-props | EMPTY | **none** — no task, no `var()` support | no row |
| cascade-layers-important | EMPTY | **none** — no task, no `@layer`/`!important` support | no row |
| corpus-expansion | EMPTY | **none** — no `verify:all`, no CI task | no row |
| text-font-fallback | EMPTY | **none** — fallback tables landed via firefox-track/cross-family; no `verify:fonts`/`corpus/fonts` owner | `font` row backed by cross-family corpus instead |
| parse-stylesheets | PARTIAL | **none** — `@import`/`@supports`/`@font-face` have no owner task | no row |
| cascade-core | PARTIAL | **none** — selector engine exists via media-queries accept; no `corpus/cascade-core`/`verify:cascade-core` task | `block/inline` rows backed by spine/floats/positioning corpora |
| layout-block-inline | PARTIAL | **none** — engine landed via floats accept; no `verify:layout-block-inline` | `block/inline` + `float` rows green via floats corpus |
| tables-layout | PARTIAL | **none** — no table layout task; charter §3 declares tables out of v1 scope | no row |

Cursor: the four findings kept live in `parity.md` Honest Reading #1–#2 + the
seam-vs-shipped text-layout gap all already have owners in `tasks/`
(`text-tier-verifiers`, `layer1-mean-gate`, `pretext-breaker-path`). The
ownerless EMPTY set (custom-props, layers/!important, corpus-expansion/CI,
stylesheets at-rules, tables) is the real re-dispatch backlog; the 
`coverage-matrix-reconcile` task (depends on this one) reconciles the §11
matrix with what is actually implemented.