# Quality Audit Ledger — recursion chain registry

This ledger is the durable state of the quality-audit recursion chain: the
findings registry from the full code/ledger/architecture analysis, the loop
protocol every chain task carries verbatim, and the attempt log that stops the
chain from repeating failed approaches or recursing forever.

- **Analysis provenance (gen 0):** 2026-09-03, at `0180452` (post `outline`
  landing, pre `tables-border-collapse`). Method: three parallel module
  deep-dives (layout; cascade/canvas/harness/config; scripts/ledgers/corpus),
  every headline claim spot-verified against HEAD by direct read/grep before
  being recorded here. Prior review history: `docs/review-honest-assessment.md`
  + `docs/review-response.md` (2026-08-17) — their still-open items are folded
  into QA-01..QA-15 below.
- **Generation-1 re-verification:** 2026-09-04, at post `tables-border-collapse`
  HEAD (`3408a37`). Method: direct read/grep re-verification of every registry
  row at HEAD — deep re-checks on QA-01, QA-02, QA-06, QA-09, QA-10, spot-checks
  on the rest; every row re-dispositioned below with file:line evidence. QA-06
  resolved as disproven (intentional); QA-01/QA-02/QA-10 drifted-further. No
  product code changed.
- **Baseline at gen-1 re-verification:** `npm run build` green (tsc, no
  errors); `check-charter` PASS (icu 78.3, node 26.8.1, 4 typed gap
  declarations, all with reason+sunset); working tree clean.
- **Status vocabulary:** `open` / `fixed` / `disproven` / `retired` (≥10
  attempts, see protocol §5) / `registered` (recorded for a future generation).

## Findings registry

| ID | Sev | Area | Finding | Evidence (gen-1 HEAD 3408a37) | Fix direction | Status | Attempts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | high | arch | `block-inline.ts` ⇄ `tables.ts` runtime import cycle plus a side-channel global: tables.ts exports `setTableAvailableInlineSize` which block-inline sets as a side effect of width resolution; table UA defaults live in the layout monolith (`tableDefaultsFor`) while all other UA decls come from `cascade/ua.ts` (split-brain) | cycle persists: `block-inline.ts:31` ⇄ `tables.ts:49`; side-channel persists: `block-inline.ts:1596` → `tables.ts:2044`, module global `lastAvailableInlineSize` (`tables.ts:1478`) read at `tables.ts:1556,1630`; `tableDefaultsFor` still `block-inline.ts:110-130`; `cascade/ua.ts` has no table-tag decls | tables receives an injected width context/callback instead of importing the monolith; move table UA defaults into `cascade/ua.ts` | open — drifted-further (fix task `qa01-break-tables-cycle` created gen 1) | 0 |
| QA-02 | high | code | Intrinsic-sizing helpers quadruplicated across flexbox/grid/tables/block-inline **with real drift**: grid skips `display:table` children where flex does not; flex skips `position:absolute/fixed` where grid does not; flex honors `box-sizing:border-box` via `borderBox()` where grid reads `style.width.px` raw; tables measures collapsed spaces with one `spaceW` vs block-inline per-piece run style; tables caps max at `break` pieces vs block-inline skipping breaks. Plus the dead `minimum` return field on `inlineContributions` | all five drift axes + dead field re-confirmed: `flexbox.ts:136,164,180,197-198` vs `grid.ts:63-134` (display:table skip 69,85; no position skip 106-113; raw `width.px` 123; dead `minimum` 121,128,133, zero readers) vs `tables.ts:769-815` (single `spaceW` 741, break-capped max 743-748) vs `block-inline.ts:2904-2943` (per-piece run style) | one shared intrinsic-sizing module in layout, parameterized by display-skip/space-style/break policy; delete `minimum` | open — drifted-further (fix task `qa02-unify-intrinsic-sizing` created gen 1) | 0 |
| QA-03 | high | machine-check | `check-charter.mjs` parses only the §11 matrix table; the **Deferred / Not in v1** section (charter.md:221-258) — the documented "no silent absence" contract — has zero machine enforcement | `scripts/check-charter.mjs:176-227` still parses only the §11 matrix; `docs/charter.md:221-258` Deferred section unenforced | give the Deferred section a table schema (Absent surface / Status / Evidence) and extend check-charter to assert token presence/absence per status | open (fix task `charter-deferred-enforcement` exists, gen 0, unlanded) | 0 |
| QA-04 | high | ledger | `docs/ledgers/coverage-matrix.md` contradicts charter §11: its deferred table claims box-shadow, opacity, calc/min/max/clamp, custom-properties/var() EMPTY/absent while §11 marks all of them implemented with corpus coverage and the corpus dirs exist and verify; also says "all 53 rows" while the matrix has 105 | `docs/ledgers/coverage-matrix.md:76-80,112` contradictions persist unchanged at gen-1 HEAD | regenerate the ledger's deferred table from the charter (after QA-03's schema), never hand-write it | open (tied to QA-03's schema) | 0 |
| QA-05 | high | gates | Verify-gate coverage holes: **9 verify scripts are not in `verify:all`** (verify-colors, verify-custom-properties, verify-legacy-removal, verify-measure-perf, verify-measure-persist, verify-paint-fallback, verify-paint-perf, verify-property-coverage, verify-rtl); `verify-rtl.mjs` and `verify-paint-fallback.mjs` are wired into **no** npm script at all; `parity.md` still calls the 21-script subset "the full `npm run verify`" | `package.json:22` `verify:all` still omits all 9; grep of package.json for `verify-rtl`/`verify-paint-fallback`: zero npm entries; `docs/ledgers/parity.md:24` overclaim persists | wire all environment-independent scripts into `verify:all`, give the remaining two npm entries (or a documented tier), fix the parity.md wording | open (fix task `verify-gate-coverage` exists, gen 0, unlanded) | 0 |
| QA-06 | medium | code | sRGB linearization duplicated across the product/harness boundary **with coefficient drift**: `paint.ts` uses Blink-port coefficients (0.2126/0.7152/0.0722) vs `harness/deltaE.ts` sRGB spec coefficients (0.2126729/0.7151522/0.072175), same 0.04045/12.92/1.055/2.4 curve | **disproven — intentional:** `paint.ts:215-222` is a documented **WCAG relative luminance** (rounded 0.2126/0.7152/0.0722) for the inset/outset border heuristic; `deltaE.ts:38-53` is a full **CIE XYZ→Lab** matrix (0.4124564/0.3575761/0.1804375; 0.2126729/0.7151522/0.072175; 0.0193339/0.119192/0.9503041) for ΔE\*ab per charter. Different formulas, each correct for its use; the only shared piece is the byte-identical `srgbToLinear` curve (`paint.ts:219` / `deltaE.ts:35`) — a hygiene nit, not a drift bug | (disproven — no fix task) | **disproven** (gen-1 verification; evidence above) | 0 |
| QA-07 | med-high | scripts | The verify harness is hand-rolled ~35×: scripts define a `fixtures()` walker, 35 copies of `textRegionMask()`, ~40 near-verbatim Chrome-harvest blocks, ~42 identical report tails; `verify-tables.mjs` vs `verify-layout-flexbox.mjs` are 241-line files differing in 14 lines. `scripts/lib/` is nearly orphaned (5 importers) | gen-1: 52/57 verify scripts contain a `fixtures()` walker; `textRegionMask` duplicated in 36 scripts; `verify-tables.mjs` vs `verify-layout-flexbox.mjs` still 241-line files, now differing in 24 lines | extract `scripts/lib/runner.mjs` (discover fixtures → harvest → mask → evaluate → report) with per-corpus hooks; migrate in batches, `verify:all` green after each batch | open | 0 |
| QA-08 | medium | ledger | `docs/ledgers/parity.md` stale: gap census says 2 declarations and lists `media-queries/container-gap`, but the corpus now has **4 typed gap declarations across 3 fixtures** (`container-gap` flipped to pass; `legacy-removal/legacy-elements` declares 3 and is omitted); its Latest Run (2026-08-14/17) predates the 2026-09-03+ landings | `docs/ledgers/parity.md:24` still calls the fast subset "the full `npm run verify`"; Latest Run rows still 2026-08-14/17, predating unicode-bidi/text-level-ua/tables/outline/sweep + tables-collapse | regenerate census + Latest Run from real runs (extend the sweep/layers refresh pass to this ledger) | open | 0 |
| QA-09 | medium | code | Cascade parse-helper duplication family: `supports.ts:27-43` `splitValue` is a byte-clone of **already-exported** `css.ts:1018` `splitTopLevel`; selector-list splitter ×2; aspect-ratio comparator ×2 with duplicated ratio parsing; media comparator ×2 with identical semantics; container-condition grammar is a parallel media-grammar with a hand-maintained `==` divergence (Blink-correct, but two tables) | `supports.ts:27-43` byte-clone of exported `css.ts:1018` (supports.ts:26 comment now stale — says "private"); selector-list splitter `stylesheet.ts:135-167` vs `selector.ts:422-464`; media comparator `media.ts:326-345` vs `media-queries.ts:133-152`; aspect-ratio comparator `media.ts:369-394` vs `media-queries.ts:102-127` (the latter re-parses the ratio via split/parseFloat) | one splitter, one scanner, one comparator each; parameterize the container dialect flag | open | 0 |
| QA-10 | medium | arch | Monoliths and hidden state: `block-inline.ts` is 3429 lines / 9 responsibilities; `makeStyle` spans ~990 lines running parse+assemble per property; the block-level display skip list appears 4× inside block-inline with term drift; border-box height normalization duplicated; module-level mutable layout globals | gen-1, drifted-further: `block-inline.ts` now **3448** lines; `layoutElementBox` ~515 (`1023-1538`), `layoutInlineContent` ~404 (`3045-3448`); `makeStyle` ~1022 (`css.ts:1851-2872`); display-skip lists now ≥7 sites with term drift (906/911, 922/927, 951, 976, 1932-1937, 2029, 2134-2135, 2818/2832); module globals `paintScPath` 530, `cbStack` 534, `clipStack` 544, `opacityStack` 561 | extract behind existing exports: style-resolve / paint-op / inline-format / block-flow; one `isBlockLevel()` predicate; thread the stacks. `makeStyle` splits per property-group | open — drifted-further | 0 |
| QA-11 | medium | config | `safari.ts:34` hardcodes `/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf`, violating the stated no-home-dir policy (`chrome.ts` `fontPath` pattern; vendored copy exists at `fonts/HackNerdFont-Regular.ttf`); `chrome.ts:131` lists `'Droid Sans Japanese'` in scriptCoverage with no registration/fallback reference (verify, then remove); safari config is wired but has no verification loop (unlike firefox) — probe-only per charter §4 until WebKit oracle lands | `src/config/safari.ts:34` hardcoded home-dir path persists; `src/config/chrome.ts:131` `'Droid Sans Japanese'` row still unverified | route through `fontPath(env, repoFile)`; drop dead row after grep-disproof of references; ledger marks safari probe-only | open (fix task `safari-config-fix` exists, gen 0, unlanded) | 0 |
| QA-12 | medium | code | measure/canvas seam duplication: alignment/justify block copy-pasted 3× inside `measure.ts` + once at block-inline; indent-mode logic duplicated; `skia.ts` duplicates its `measure`/`hasFamily` closures internally; `pretext/index.ts` constructs a **new `Intl.Segmenter` per call** on the hot measure path while `script-fallback.ts` holds a singleton; two font-shorthand parsers at the same seam; dead export `fontMetricsKey` | `pretext/index.ts:135` per-call `new Intl.Segmenter` vs `script-fallback.ts:122` singleton; `skia.ts:57-60` vs `143-144` duplicated `measure`/`hasFamily` closures — all re-confirmed at gen-1 HEAD | one alignment/justify helper, one indent-mode helper, skia closures to private methods, one shared segmenter + shorthand parser in `canvas/` | open | 0 |
| QA-13 | low-med | hygiene | Drift-prone edges: fallback tables hand-mirrored into 3 ledgers with no sync check and `chrome.ts` self-mapping rows appear in no ledger; config⇄canvas module cycle; barrel gaps; dead mode validation `tolerances.ts:81`; `media.ts:9-10` header claims `print` support but the evaluator drops `@media print`; ~17 zero-reader cascade exports + 5 unread pretext wrapper types + `SkiaCanvasFactory` class export unread | `tolerances.ts:81` still `x === 'exact' ? 'exact' : 'exact'`; `media.ts:10` still claims `print` while evaluator `media.ts:477` drops it (all/screen only); `canvas/index.ts` still omits `measure-cache`, `cascade/index.ts` still omits `supports` | generated-or-asserted ledger tables; registered invalidate callback breaks the config cycle; barrel completion; validation fix; dead-export sweep batch | open | 0 |
| QA-14 | low | scripts | Two font conventions across verify scripts: 44 read `FONT_FILE`/`FONT_FAMILY` env, 11 use `chromeConfig.defaultFamily/defaultFile`, 4 use neither — harvest setups are not interchangeable | gen-1: 45 scripts read `FONT_FILE`/`FONT_FAMILY`, 6 use `chromeConfig.defaultFamily`, the rest neither | fold into QA-07's runner (one convention, env override preserved) | open (fold into QA-07) | 0 |
| QA-15 | low | code | `LATIN_SAFE_RE` (`script-fallback.ts:157`) deliberately matches ASCII control characters (`\x00-\x7F`, intent documented inline); the TS language server flags it (`no-control-regex`-class diagnostic). Build is green today, but a future lint gate would fail on it | `src/canvas/script-fallback.ts:157` unchanged; gen-1 HEAD has **no lint/typecheck npm script** (package.json grep: none) — nothing can flag it today | verify-first: if no lint gate exists, the inline justification is already present — either wire an eslint-disable with reason or narrow the class if controls are unreachable in text content; only matters once a lint gate lands | open (registered; conditional on a lint gate landing) | 0 |

Historical context the chain must know (from the 2026-08-17 review pair): the
breaker path needed 3 attempts (first two landed empty archives before the
session-idle no-op guard `94e3e04`); `tables-layout` first archived PARTIAL
(parsing + UA defaults only) before the real slice. Size slices so the named
gate can actually pass; empty/no-op landings are refused by the hook.

## Loop protocol (carried verbatim into every chain task)

This task is generation N of a capped recursion chain (`quality-audit-N`). The
chain's purpose: continuously raise code/ledger/gate quality **without
regressing the established tests, ledgers, and tolerances**.

Hard rules for you **and every task you create**:

1. **Work only inside this repository worktree.** Never read, write, or cd into
   `.orchestration/`, `tmp/`, `/tmp`, or any path outside the worktree; never
   invoke the `orch` CLI from a shell; never `git push`; never do anything that
   could raise a permission prompt — the operator is unavailable. Scratch files
   are forbidden; if a temp file is unavoidable, put it under `docs/reports/`
   (gitignored) and delete it before finishing.
2. **Do the work and commit it.** No human gates: every task you create must
   have `wait_human_start: false` and `wait_human_merge: false`. Leave nothing
   uncommitted when you finish.
3. **Create at most 3 tasks total per task execution**, via the create_task
   tool only. Exactly one must be the successor audit `quality-audit-(N+1)`
   with dependencies on the fix tasks you created this generation — unless
   N = 5, in which case you create **no** successor: the chain ends and every
   remaining finding gets a final disposition in this ledger instead. Fix tasks
   never spawn additional audit chains — exactly one audit chain exists.
4. **Recursion state lives in this ledger.** Before finishing: update finding
   statuses, attempt counts, and the touched-areas log below. The successor
   audit's spec must embed: open findings, touched areas since the previous
   generation, and every failed/disproven attempt with its reason — so no
   attempt is repeated blind.
5. **Retry cap.** A finding with ≥10 recorded task attempts across the chain is
   `retired`: record the retirement with evidence; never create another fix
   task for it. Within your own run: if an approach fails twice, switch
   approach once; if that fails too, record both attempts here and stop. If you
   cannot complete your fix, **never leave the chain dead** — still create the
   successor audit recording the blockage.
6. **Re-verify first.** Every created task begins by re-verifying its finding
   against HEAD (the tree moves between generations). If the finding is
   disproven, the task completes by recording the disproof (grep/oracle
   evidence) in this ledger and its commit message — code unchanged, no
   manufactured work, and **no silent drops**. If it is real, fix it.
7. **Never weaken established quality to pass a gate.** No tolerance edits, no
   fixture deletion/skipping, no hand-edited ledger numbers (ledgers update
   from real script runs only), no disabling of verify scripts. `npm run
   build`, the targeted verify gates for touched areas, and
   `node scripts/check-charter.mjs` must pass before you finish.
8. **Fix tasks are one context window each** — a single vertical slice with
   runnable verification. Prefer mechanical refactors guarded by existing
   gates. A finding needing a design decision is recorded in this ledger for
   the next audit, not turned into a speculative task.
9. **Important out-of-scope discoveries must become created tasks** (within
   the cap of 3; beyond it, register them here for the next audit with
   priority).

## Touched-areas log (appended per generation)

- Generation 0 (this analysis, `0180452`): no code touched. Registry created;
  tasks `verify-gate-coverage`, `charter-deferred-enforcement`,
  `safari-config-fix`, `quality-audit-1` created from QA-05, QA-03+QA-04+QA-08,
  QA-11, and the chain anchor respectively.
- Generation 1 (`3408a37`): tables-border-collapse landed (border-collapse
  model — `corpus/tables-collapse/`, `tables.ts` grew to 2060 lines, table
  paths in `block-inline.ts`); timing ledgers refreshed (layers, sweep,
  text-measure); engine-vs-oracle spine ledger refreshed. The audit itself
  touched no product code: it re-verified all 15 rows, dispositioned QA-06 as
  disproven, created fix tasks `qa01-break-tables-cycle` (QA-01) +
  `qa02-unify-intrinsic-sizing` (QA-02), and this successor
  `quality-audit-2`.

## Attempt log (appended per generation; feeds the ≥10 retirement rule)

| Finding | Task | Generation | Attempt # | Approach | Outcome + reason |
| --- | --- | --- | --- | --- | --- |
| QA-06 | (none — verification, not a task attempt) | 1 | 0 | verify-first re-check of the sRGB coefficient drift against HEAD | disproven — intentional: `paint.ts:215-222` is a documented WCAG relative luminance (rounded 0.2126/0.7152/0.0722) for the inset/outset border heuristic; `deltaE.ts:38-53` is a full CIE XYZ→Lab matrix (0.2126729/0.7151522/0.072175) for ΔE\*ab. Different formulas, each correct; shared `srgbToLinear` curve is a hygiene nit only. No fix task created. |
