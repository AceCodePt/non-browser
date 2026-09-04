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
- **Generation-2 (QA-01 fix task `qa01-break-tables-cycle`) landing:** the
  side-channel and UA-defaults slices of QA-01 landed (2026-09-04, on this
  branch): `setTableAvailableInlineSize`/`lastAvailableInlineSize` deleted and
  the available inline size threaded explicitly through
  `TableLayoutInput.availableInlineSize`; `tableDefaultsFor` deleted and the
  table-tag UA rules moved to `cascade/ua.ts`. The block-inline⇄tables import
  cycle itself is registered as the residual (extraction of `layoutElementBox`
  + transitive deps is multi-window). Build green; check-charter PASS;
  verify:tables / verify:tables-collapse / verify:ua-styles /
  verify:text-level-ua all PASS at landing.
- **Generation-2 (QA-02 fix task `qa02-unify-intrinsic-sizing`) landing:**
  2026-09-04, on this branch: the four local content-intrinsic helpers
  (flexbox/grid/tables/block-inline) consolidated into one shared module
  `src/layout/intrinsic.ts` (298 lines) exposing `contentInlineSizes` /
  `pieceContentSizes` / `inlineContribution` parameterized by an
  `IntrinsicPolicy` / `PieceSizingPolicy`; every caller's exact behavior is
  preserved via its policy object (flexbox: `skipPositioned`+`borderBox`+`rowFlex`;
  grid: `blockDisplays` includes `table`, `skipPositioned:false`, `borderBox:false`;
  tables: `pieceText`+`childMargins`+`spaceStyle:'single'`+`breaks:'cap'`;
  block-inline: `spaceStyle:'piece'`+`breaks:'skip'`); the dead `minimum` field
  deleted from grid's `inlineContributions`. `grep "\.minimum" src/layout/grid.ts`
  empty; exactly one `contentInlineSizes` definition in `src/layout/` at
  `intrinsic.ts:246`; all four callers import from `./intrinsic.js`. Ledgers
  icu/layers/sweep/text-measure refreshed by real script runs. Build green;
  check-charter PASS; `npm run verify:all` exit 0 at landing. (Note: the qa02
  landing did not write its attempt-log row — this generation records it below.)
- **Generation-2 re-verification (this run):** 2026-09-04, at post-fix HEAD
  (`9ac5904`, both fix tasks merged). Method: direct read/grep re-verification
  of every row at HEAD — deep re-checks on QA-01/QA-02 (their fix tasks just
  landed), the rest spot-checked to fresh line numbers. QA-02 re-dispositioned
  **fixed**; QA-01 re-confirmed **registered** (residual import cycle only);
  QA-08 + QA-10 drifted-further; QA-04 gained drift (its `tables-layout` row is
  now stale post tables-border-collapse). Fix tasks `qa07-verify-runner`
  (QA-07) + `qa10-unify-block-display-skip` (QA-10 slice) and successor
  `quality-audit-3` created. Baseline at gen-2 HEAD: `npm run build` green;
  `check-charter` PASS (icu 78.3, node 26.8.1, 4 typed gap declarations);
  verify:tables / verify:tables-collapse / verify:ua-styles re-run green here.
- **Generation-2 (QA-07 fix task `qa07-verify-runner`) landing:** 2026-09-04,
  on this branch: `scripts/lib/runner.mjs` (293 lines) consolidates the
  per-script pipeline — `fixtures(corpus)` walker, `textRegionMask()`,
  `harvestChrome()` (rects/measureText/computedStyle/text-fragments/screenshot,
  computedStyle driven by the fixture's `harvest.computedStyle`), `renderCandidate()`
  (computedStyle passed to renderHtml only when the fixture declares one),
  `exclusionMask()`, `writeArtifacts()`, `reportTail()`, and the `runVerify()`
  orchestrator. The table family migrated onto it as the proof batch:
  `verify-tables.mjs` + `verify-tables-collapse.mjs` + `verify-layout-flexbox.mjs`
  (the near-identical flexbox twin) are now ~30-line imports of `runVerify`.
  Closure at landing: `grep 'from \x27./lib/\x27' scripts/verify-tables.mjs
  scripts/verify-tables-collapse.mjs` non-empty; `grep 'function textRegionMask'
  scripts/verify-tables.mjs scripts/verify-tables-collapse.mjs` empty;
  textRegionMask copy count 36→33 and fixtures()-walker count 51→48 across
  scripts/*.mjs (strictly down). Build green; check-charter PASS; verify:tables /
  verify:tables-collapse / verify:layout-flexbox / verify:all all exit 0 at
  landing. QA-14 folds into the runner (one FONT_FILE/FONT_FAMILY convention,
  env override preserved). The residual — the remaining corpus families, one
  batch each — is registered as a per-batch roadmap below.
- **Generation 3 (QA-10 fix task `qa10-unify-block-display-skip`) landing:**
  2026-09-04, on this branch: ONE shared `isBlockLevel(display)` predicate
  (`block-inline.ts`, exported) and the four display-skip list sites migrated
  onto it, each caller's float/position variant preserved explicitly. Re-verify
  first (QA-10 confirmed open): the lists still existed at
  `block-inline.ts:872` (float), `888` (float + position), `937` (neither),
  `2777` (float + position). After the fix the full display enumerations live
  only inside the predicate — `grep -n "s.display === 'block'"
  src/layout/block-inline.ts` empty, `grep -c 'function isBlockLevel'
  src/layout/*.ts` is 1. QA-10 → **registered** (residual: the monolith
  extraction of style-resolve / paint-op / inline-format / block-flow, stack
  threading, and the makeStyle split — see attempt log). Build green;
  check-charter PASS; verify:all exit 0 at landing. No new tasks created (the
  gen-2 audit's successor `quality-audit-3` owns the next chain step).
- **Generation-3 re-verification (this run):** 2026-09-04, at post-fix HEAD
  (`cd18e34`, both gen-3 dependencies — qa07-verify-runner +
  qa10-unify-block-display-skip — landed). Method: direct read/grep
  re-verification of every row at HEAD — deep re-checks on QA-07 + QA-10 (their
  fix tasks just landed), spot-checks on the rest to fresh line numbers.
  QA-07 re-confirmed **registered**: `scripts/lib/runner.mjs` (286 lines) is
  the single shared pipeline; the three migrated scripts are ~28-line `runVerify`
  imports; `grep 'function textRegionMask' scripts/verify-tables.mjs
  scripts/verify-tables-collapse.mjs scripts/verify-layout-flexbox.mjs` empty;
  copy counts 36→33 (textRegionMask) and 51→48 (fixtures walker); verify:tables /
  verify:tables-collapse / verify:layout-flexbox re-run green here.
  QA-10 re-confirmed **registered**: `isBlockLevel` at `block-inline.ts:860`,
  four sites at 886/905/957/2799; `grep -n "s.display === 'block'"
  src/layout/block-inline.ts` empty; `grep -c 'function isBlockLevel'
  src/layout/*.ts` = 1. QA-02 stays fixed; QA-01 stays registered (cycle edge
  unchanged: `block-inline.ts:31` ↔ `tables.ts:48`); QA-06 stays disproven
  (not re-opened). Open rows re-confirmed with fresh evidence: QA-03
  (check-charter.mjs:176-227 still parses only §11; charter.md:223 unenforced),
  QA-04 (coverage-matrix.md:76-80/78/112 stale), QA-05 (all 9 scripts still out
  of verify:all; verify-rtl + verify-paint-fallback zero npm entries),
  QA-08 (container-gap fixture.json now declares `computedStyle: "pass"` —
  census stale; legacy-elements declares 3 typed gaps; check-charter reports 4),
  QA-09 (all four duplication pairs present at HEAD), QA-11 (safari.ts:34
  hardcoded path + chrome.ts:131 row), QA-12 (pretext/index.ts:135 per-call
  Segmenter; skia.ts:57-64 vs 143-147; fontMetricsKey dead — zero read sites),
  QA-13 (tolerances.ts:81, media.ts:10, canvas/cascade barrel gaps),
  QA-15 (script-fallback.ts:157; package.json has zero lint scripts).
  Fix tasks `qa09-unify-cascade-parse-helpers` (QA-09) +
  `qa12-unify-measure-seam` (QA-12) and successor `quality-audit-4` created.
  Baseline at gen-3 HEAD: `npm run build` green; `check-charter` PASS
  (icu 78.3, node 26.8.1, 4 typed gap declarations); verify:tables /
  verify:tables-collapse / verify:layout-flexbox re-run green here.
- **Generation-4 re-verification (this run):** 2026-09-04, at post-fix HEAD
  (`9523c2c`, both gen-3 dependencies — qa09-unify-cascade-parse-helpers +
  qa12-unify-measure-seam — landed and archived). Method: direct read/grep
  re-verification of every row at HEAD — deep re-checks on QA-09 + QA-12 (their
  fix tasks just landed), spot-checks on the rest to fresh line numbers.
  QA-09 re-confirmed **registered**: `splitValue` gone from supports.ts (the
  nine call sites import the exported `css.ts:1018` `splitTopLevel`),
  `splitSelectorList` single at `selector.ts:429` (stylesheet.ts:304 imports
  it, local `splitSelectors` deleted), `parseRatio` + `compareAspectRatio`
  single at `media.ts`, `compareNum` single at `media.ts:356`
  (`phases/media-queries.ts` local `compare` deleted); container-condition
  dialect residual unchanged (`media.ts:21-22` still documents the `==`
  Blink divergence). QA-12 re-confirmed **registered**: `graphemeSegmenter`
  module singleton at `pretext/index.ts:130` (per-call construction gone),
  skia's shared private `measureWidth`/`hasFamily` methods serving both
  `measureText` and `drawText` (`grep "const measure|const hasFamily"`
  empty), dead export `fontMetricsKey` deleted (zero read sites, unused
  `createHash` import gone); residual alignment/justify + indent-mode +
  font-shorthand-parser consolidations unchanged. QA-02 stays fixed; QA-06
  stays disproven (not re-opened); QA-01 stays registered (cycle edge
  unchanged at `block-inline.ts:31` ↔ `tables.ts:48`). Open rows re-confirmed
  with fresh evidence: QA-03 (check-charter.mjs:176-227 still §11-only;
  charter.md:223 unenforced), QA-04 (coverage-matrix.md:76-80/78/112 stale),
  QA-05 (all 9 scripts still out of verify:all; verify-rtl + verify-paint-fallback
  zero npm entries), QA-08 (parity.md census still lists container-gap which
  now declares `expected.computedStyle: "pass"`; omits legacy-elements' 3 typed
  gaps; "Current count: 2" vs check-charter's 4; Latest Run 2026-08-14/17
  stale), QA-11 (safari.ts:34 hardcode persists; chrome.ts:131 dead row),
  QA-13 (tolerances.ts:81 dead ternary; media.ts:9-10 print claim vs
  evaluator :486; canvas/cascade barrel gaps), QA-15 (script-fallback.ts:157;
  zero lint scripts). **QA-16 DISPROVEN at gen-4 HEAD:** `package-lock.json`
  IS committed (tracked since a4d5a55, 2026-08-13, present at gen-3 and gen-4
  HEAD) and pins all seven deps exactly (typescript 5.9.3, @napi-rs/canvas
  1.0.5, playwright 1.62.1, @types/node 20.19.43…); README.md:13 documents
  `npm install`; the gen-3 "git ls-files shows none" claim was factually
  wrong, and the candidate.png byte drift was install-environment noise
  (verify PASS either way). Fix task `qa13-drift-prone-edges` (QA-13) and
  successor `quality-audit-5` created. Baseline at gen-4 HEAD: `npm run build`
  green; `check-charter` PASS (icu 78.3, node 26.8.1, 4 typed gap
  declarations).
- **Generation-5 re-verification (this run, N=5 — FINAL generation):**
  2026-09-04, at post-fix HEAD (`39556aa`, the gen-4 dependency
  `qa13-drift-prone-edges` landed and archived). Method: direct read/grep
  re-verification of every registry row at HEAD — deep re-check on QA-13 (its
  fix task just landed), spot-checks on the rest to fresh line numbers.
  QA-13 re-confirmed **registered**: barrels complete (`canvas/index.ts:2`
  `export * from './measure-cache.js'`; `cascade/index.ts:11`
  `export * from './supports.js'`), ternary collapsed to `mode: 'exact'` at
  `tolerances.ts:81`, media header `media.ts:10-12` agrees with the evaluator
  at `:486`; residuals (config⇄canvas cycle `browser-config.ts:13` →
  `canvas/measure-cache.js`, fallback-table ledger mirroring, zero-reader
  exports) unchanged. QA-02 stays fixed; QA-06 + QA-16 stay disproven (not
  re-opened); QA-01 stays open (cycle edge unchanged at `block-inline.ts:31`
  ↔ `tables.ts:48`). Open rows re-confirmed with fresh evidence: QA-03
  (check-charter.mjs:176-227 still §11-only; charter.md:223 unenforced), QA-04
  (coverage-matrix.md:76-80/112 stale vs charter §11:140-143,174-175,179,
  196-200; §11 now 106 data rows), QA-05 (all 9 scripts still out of
  verify:all; verify-rtl + verify-paint-fallback zero npm entries),
  QA-08 (parity.md census still lists container-gap which now declares
  `expected.computedStyle: "pass"`; omits legacy-elements' 3 typed gaps;
  "Current count: 2" vs check-charter's 4), QA-11 (safari.ts:34 hardcode
  persists; chrome.ts:131 'Droid Sans Japanese' dead row), QA-15
  (script-fallback.ts:157; zero lint scripts). **N=5 is the chain cap — no
  successor `quality-audit-6` was created; every registry row below received
  its FINAL disposition (open / fixed / disproven / retired) with evidence.**
  The two highest-severity verified open findings without a live fix task got
  fix tasks this generation: `qa03-charter-deferred-enforcement` (QA-03 +
  QA-04 + QA-08) and `qa05-verify-gate-coverage` (QA-05); both supersede the
  stale gen-0 specs `charter-deferred-enforcement` / `verify-gate-coverage`
  (created gen 0, never dispatched across 5 generations). Baseline at gen-5
  HEAD: `npm run build` green; `check-charter` PASS (icu 78.3, node 26.8.1,
  4 typed gap declarations).
- **Status vocabulary:** `open` / `fixed` / `disproven` / `retired` (≥10
  attempts, see protocol §5) / `registered` (recorded for a future generation).

## Findings registry

| ID | Sev | Area | Finding | Evidence (re-verified at gen-5 HEAD 39556aa) | Fix direction | Status | Attempts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | high | arch | `block-inline.ts` ⇄ `tables.ts` runtime import cycle plus a side-channel global: tables.ts exports `setTableAvailableInlineSize` which block-inline sets as a side effect of width resolution; table UA defaults live in the layout monolith (`tableDefaultsFor`) while all other UA decls come from `cascade/ua.ts` (split-brain) | gen-2: side channel + UA split-brain **fixed** — `grep -rn "setTableAvailableInlineSize\|lastAvailableInlineSize" src/` empty; `grep -n "tableDefaultsFor" src/layout/block-inline.ts` empty; table-tag UA rules at `cascade/ua.ts:118-122`. Residual persists (gen-4 re-confirmed): `block-inline.ts:31` → `tables.js` and `tables.ts:48` → `block-inline.js` (mutual import edge unchanged) | tables receives an injected width context/callback instead of importing the monolith; move table UA defaults into `cascade/ua.ts` (both done) — residual cycle: extract `layoutElementBox` + transitive deps into a shared layout module | **open** (FINAL at N=5 — gen-2 fix task `qa01-break-tables-cycle` landed: side channel eliminated, UA defaults moved; gen-5 re-confirmed — cycle edge unchanged at `block-inline.ts:31` → `tables.js` and `tables.ts:48` → `block-inline.js`. The monolith extraction of `layoutElementBox` + transitive deps is multi-thousand-line and never attempted; the chain ends at N=5, so this residual is recorded as terminal, not handed to a generation 6 — see attempt log) | 1 |
| QA-02 | high | code | Intrinsic-sizing helpers quadruplicated across flexbox/grid/tables/block-inline **with real drift**: grid skips `display:table` children where flex does not; flex skips `position:absolute/fixed` where grid does not; flex honors `box-sizing:border-box` via `borderBox()` where grid reads `style.width.px` raw; tables measures collapsed spaces with one `spaceW` vs block-inline per-piece run style; tables caps max at `break` pieces vs block-inline skipping breaks. Plus the dead `minimum` return field on `inlineContributions` | **fixed** at gen-2 HEAD, re-confirmed gen-4: one shared module `src/layout/intrinsic.ts` with policy knobs for all five drift axes (`IntrinsicPolicy`/`PieceSizingPolicy`); four callers import from `./intrinsic.js` (`flexbox.ts:45`, `grid.ts:35`, `tables.ts:49`, `block-inline.ts:32`); all five axes preserved per caller (`flexbox.ts:53-62` skipPositioned/borderBox/rowFlex; `grid.ts:42-51` blockDisplays incl. `table`, skipPositioned:false, borderBox:false; `tables.ts:59-70` pieceText/childMargins/childDisplays/nestedTableWidth, spaceStyle 'single' breaks 'cap'; `block-inline.ts:2654` spaceStyle 'piece' breaks 'skip'); dead `minimum` gone (`grep "\.minimum" src/layout/grid.ts` empty); single `contentInlineSizes` at `intrinsic.ts:246` | one shared intrinsic-sizing module in layout, parameterized by display-skip/space-style/break policy; delete `minimum` | **fixed** (gen-2 fix task `qa02-unify-intrinsic-sizing`; gen-5 re-confirmed — single `contentInlineSizes` at `intrinsic.ts:246`, four callers import from `./intrinsic.js`, `grep "\.minimum" src/layout/grid.ts` empty; verify:all exit 0 at landing) | 1 |
| QA-03 | high | machine-check | `check-charter.mjs` parses only the §11 matrix table; the **Deferred / Not in v1** section (charter.md:223) — the documented "no silent absence" contract — has zero machine enforcement | gen-4 re-confirmed: `scripts/check-charter.mjs:176-227` still parses only the §11 matrix (`matrixMarker` at :176, rows at :190-227, nothing past it); `docs/charter.md:223` "Deferred / Not in v1 (no silent absence)" section unenforced | give the Deferred section a table schema (Absent surface / Status / Evidence) and extend check-charter to assert token presence/absence per status | open (gen-5 re-confirmed: check-charter.mjs:176-227 still parses only the §11 matrix — `matrixMarker` at :176, rows at :190-227, nothing past it; charter.md:223 Deferred section unenforced. **FINAL at N=5**: fix task `qa03-charter-deferred-enforcement` created this generation — it supersedes the stale gen-0 `charter-deferred-enforcement` (never dispatched). **Fixed by that fix task at gen-5 close** — charter §11 Deferred prose restructured into a machine-checked Absent surface|Status|Evidence table (6 rows), check-charter now enforces the Deferred contract (`absent` tokens absent from src with comments stripped, `declared-divergence` tokens present + cited ledger doc; two deliberate-contradiction probes each exit 1), 105 §11 data rows + 6 deferred rows enforced) | 1 |
| QA-04 | high | ledger | `docs/ledgers/coverage-matrix.md` contradicts charter §11: its deferred table claims box-shadow, opacity, calc/min/max/clamp, custom-properties/var() EMPTY/absent while §11 marks all of them implemented with corpus coverage and the corpus dirs exist and verify; also says "all 53 rows" while the matrix has ~103 | gen-4, still drifted: `coverage-matrix.md:76-80` still lists opacity/shadow/calc/custom-props as EMPTY/never-landed while charter §11 marks them implemented=yes with corpus tokens (`charter.md:140-143,174-175,179,196-198`); `coverage-matrix.md:78` tables row still says collapse "is the follow-on" owned by `tables-border-collapse`, which LANDED gen 1; `coverage-matrix.md:112` "all 53 rows" vs 105 §11 data rows (counted this run) | regenerate the ledger's deferred table from the charter (after QA-03's schema), never hand-write it | open — drifted (gen-5 re-confirmed: coverage-matrix.md:76-80 still lists opacity/shadow/calc/custom-props as EMPTY/never-landed while charter §11:140-143 (calc/min/max/clamp), :174-175 (box-shadow/text-shadow), :179 (opacity), :196-200 (custom properties) mark them implemented=yes with corpus tokens; coverage-matrix.md:112 still says "all 53 rows" vs 106 §11 data rows counted this run). **FINAL at N=5**: covered by fix task `qa03-charter-deferred-enforcement` (regeneration from the restructured charter schema). **Fixed by that fix task at gen-5 close** — the deferred table was regenerated from the restructured charter (opacity/shadow/calc/custom-props/@supports/@container/tables-collapse are no longer listed as EMPTY/never-landed; the still-deferred surfaces mirror the charter table row-for-row), the "all 53 rows" claim corrected to **105** §11 data rows (the count check-charter now prints; the audit's "106" had counted the header row), and the archive-audit agreement section updated to reflect the landed archives) | 1 |
| QA-05 | high | gates | Verify-gate coverage holes: **9 verify scripts are not in `verify:all`** (verify-colors, verify-custom-properties, verify-legacy-removal, verify-measure-perf, verify-measure-persist, verify-paint-fallback, verify-paint-perf, verify-property-coverage, verify-rtl); `verify-rtl.mjs` and `verify-paint-fallback.mjs` are wired into **no** npm script at all; `parity.md` still calls the 21-script subset "the full `npm run verify`" | gen-4 re-confirmed: `package.json:22` `verify:all` still omits all 9 (grep per script: NOT in verify:all); `verify-rtl`/`verify-paint-fallback` grep of package.json: zero npm entries; the other 7 have npm entries but are out of verify:all; `docs/ledgers/parity.md:24` "full `npm run verify`" overclaim persists | wire all environment-independent scripts into `verify:all`, give the remaining two npm entries (or a documented tier), fix the parity.md wording | open (gen-5 re-confirmed: package.json:22 verify:all still omits all 9; verify-rtl.mjs + verify-paint-fallback.mjs have zero npm entries (grep of package.json empty); the other 7 have named npm entries but are out of verify:all; parity.md:24 overclaim persists). **FINAL at N=5**: fix task `qa05-verify-gate-coverage` created this generation — it supersedes the stale gen-0 `verify-gate-coverage` (never dispatched); the fix task records the outcome in this ledger when it lands. **Fixed by that fix task at gen-5 close** — the 8 environment-independent scripts were wired into `verify:all` (verify-colors, verify-custom-properties, verify-legacy-removal, verify-rtl, verify-property-coverage, verify-measure-perf, verify-measure-persist, verify-paint-perf); verify-paint-fallback was wired into a new documented `verify:extra` tier (its daemon-driven task-acceptance mode — reachable via `npm run verify:paint-fallback`); npm entries added for both previously-unwired scripts; parity.md's Method wording fixed (`verify:all` = full gate, `verify` = fast subset — wording only, the census/Latest Run numbers are qa03's, untouched); every scripts/verify-*.mjs filename is now reachable from package.json and `npm run verify:all` exit 0 includes the newly wired scripts | 1 |
| QA-06 | medium | code | sRGB linearization duplicated across the product/harness boundary **with coefficient drift**: `paint.ts` uses Blink-port coefficients (0.2126/0.7152/0.0722) vs `harness/deltaE.ts` sRGB spec coefficients (0.2126729/0.7151522/0.072175), same 0.04045/12.92/1.055/2.4 curve | **disproven — intentional (gen 1, unchanged, not re-opened):** `paint.ts:215-222` is a documented **WCAG relative luminance** (rounded 0.2126/0.7152/0.0722) for the inset/outset border heuristic; `deltaE.ts:38-53` is a full **CIE XYZ→Lab** matrix (0.4124564/0.3575761/0.1804375; 0.2126729/0.7151522/0.072175; 0.0193339/0.119192/0.9503041) for ΔE\*ab per charter. Different formulas, each correct for its use; the only shared piece is the byte-identical `srgbToLinear` curve — a hygiene nit, not a drift bug. No re-open evidence emerged at gen 4 | (disproven — no fix task) | **disproven** (gen-1 verification; evidence above; not re-opened at gen-5 — do not re-open on a hunch) | 0 |
| QA-07 | med-high | scripts | The verify harness is hand-rolled ~35×: scripts define a `fixtures()` walker, 36 copies of `textRegionMask()`, ~40 near-verbatim Chrome-harvest blocks, ~42 identical report tails; `verify-tables.mjs` vs `verify-layout-flexbox.mjs` are 241-line files differing in 14 lines. `scripts/lib/` is nearly orphaned (2 modules, 6 importers) | gen-2: `scripts/lib/runner.mjs` (286 lines) is the single shared pipeline; `verify-tables.mjs`/`verify-tables-collapse.mjs`/`verify-layout-flexbox.mjs` are ~28-line `runVerify` imports; `grep 'function textRegionMask' scripts/verify-tables.mjs scripts/verify-tables-collapse.mjs` empty; copy counts across scripts/*.mjs strictly down (textRegionMask 36→33, fixtures walker 51→48); `scripts/lib/` = runner.mjs + expected.mjs + sweep.mjs | extract `scripts/lib/runner.mjs` (discover fixtures → harvest → mask → evaluate → report) with per-corpus hooks; migrate in batches (table family first), `verify:all` green after each batch | **registered** (gen-2 fix task `qa07-verify-runner` landed the runner + table family; gen-5 re-confirmed at HEAD: runner.mjs 286 lines, three migrated scripts ~28-line `runVerify` imports, copy counts 36→33 / 51→48; residual = remaining corpus families — the per-batch roadmap below is **terminal at N=5**, the chain ends here) | 1 |
| QA-08 | medium | ledger | `docs/ledgers/parity.md` stale: gap census says 2 declarations and lists `media-queries/container-gap`, but the corpus has **4 typed gap declarations across 2 fixtures** (`container-gap` flipped to pass; `legacy-removal/legacy-elements` declares 3 and is omitted); its Latest Run (2026-08-14/17) predates the 2026-09-03+ landings | gen-4, still drifted: `parity.md:92-104` census lists `media-queries/container-gap` (gen-4 re-confirmed: its `fixture.json` `expected.computedStyle` is now `"pass"` — flipped, no typed gap) + `harness-tolerances/regression-divergence`, omitting `corpus/legacy-removal/legacy-elements/fixture.json` which declares 3 (`computedStyle`/`rect`/`screenshot`, all `fail` with reason+sunset); parity.md's "Current count: 2" vs check-charter's "4 typed gap declaration(s)" (re-run this gen); Latest Run rows still 2026-08-14/17 (line 23-25) predating unicode-bidi/text-level-ua/tables/outline/sweep + tables-collapse + qa07/qa09/qa10/qa12; `parity.md:24` overclaim (shared with QA-05) | regenerate census + Latest Run from real runs (extend the sweep/layers refresh pass to this ledger) | open — drifted (gen-5 re-confirmed: parity.md:92-104 census still lists media-queries/container-gap (its fixture.json `expected.computedStyle` is now `"pass"` — flipped, no typed gap) + harness-tolerances/regression-divergence, omitting corpus/legacy-removal/legacy-elements/fixture.json which declares 3 typed gaps (computedStyle/rect/screenshot, all fail with reason+sunset); "Current count: 2" vs check-charter's "4 typed gap declaration(s)" re-run this gen; Latest Run rows still 2026-08-14/17). **FINAL at N=5**: covered by fix task `qa03-charter-deferred-enforcement` (census + Latest Run refresh from real runs). **Fixed by that fix task at gen-5 close** — census rewritten from the real corpus gap declarations (`corpus/legacy-removal/legacy-elements`'s 3 typed gaps + `harness-tolerances/regression-divergence`'s 1 = "4 declarations", matching check-charter; the flipped-to-`pass` `media-queries/container-gap` retired note); Latest Run refreshed from a real 2026-09-04 run of the touched corpora — `npm run verify:calc` (7/7), `verify:shadow` (9/9), `verify:opacity` (5/5), `verify:colors` (4/4), `verify:custom-properties` (5/5) all exit 0, date + command stated in the ledger) | 1 |
| QA-09 | medium | code | Cascade parse-helper duplication family: `supports.ts:27-43` `splitValue` is a byte-clone of **already-exported** `css.ts:1018` `splitTopLevel`; selector-list splitter ×2; aspect-ratio comparator ×2 with duplicated ratio parsing; media comparator ×2 with identical semantics; container-condition grammar is a parallel media-grammar with a hand-maintained `==` divergence (Blink-correct, but two tables) | **fixed at gen-3 HEAD (fix task `qa09-unify-cascade-parse-helpers` landed), re-confirmed gen-4:** (a) one shared `splitTopLevel` (`css.ts:1018`, exported) serves supports.ts — clone deleted, `grep "function splitValue" src/cascade/supports.ts` empty (call sites at supports.ts:114-307 use the css.ts import); (b) one shared selector-list splitter `splitSelectorList` (`selector.ts:429`, exported) serves `stylesheet.ts` (local `splitSelectors` deleted) and `parseSelectorList` — `grep -c "function splitSelectorList" src/cascade/*.ts` = 1; (c) one aspect-ratio helper pair `parseRatio` + `compareAspectRatio` (`media.ts`) serves the @media and @container evaluators with the b===0 guard — `grep -c "function parseRatio" src/cascade/*.ts src/cascade/phases/*.ts` = 1; (d) one media comparator `compareNum` (`media.ts:356`, exported) serves `phases/media-queries.ts` (local `compare` deleted) — `grep -c "function compareNum\|function compare(" src/cascade/*.ts src/cascade/phases/*.ts` = 1. The container-condition grammar (`==` tokenized but rejected for @media, accepted only inside @container — media.ts:21-22) is untouched — deliberate, registered residual | one splitter, one scanner, one comparator each (done); parameterize the container dialect flag (residual) | **registered** (gen-3 fix task `qa09-unify-cascade-parse-helpers` landed — helpers consolidated + closure greps above; gen-5 re-confirmed: `grep -n "function splitValue" src/cascade/supports.ts` empty, `splitSelectorList` single at selector.ts, `parseRatio`/`compareAspectRatio` single at media.ts, `compareNum` single at media.ts:356, container dialect note at media.ts:21-22; residual = container-condition dialect parameterization — **terminal at N=5**, the chain ends here) | 1 |
| QA-10 | medium | arch | Monoliths and hidden state: `block-inline.ts` is 3429 lines / 9 responsibilities; `makeStyle` spans ~990 lines running parse+assemble per property; the block-level display skip list appears 4× inside block-inline with term drift; border-box height normalization duplicated; module-level mutable layout globals | gen-3: display-skip consolidation **done** — one exported `isBlockLevel(display)` predicate at `block-inline.ts:860`; the four walker sites call it with their float/position variants preserved (`hasInlineContent` 886 + float; `hasBlockLevelChild` 905 + float + position; `collectInlineText` 957 neither; `buildPieces` 2799 + float + position). Closure (gen-4 re-confirmed): `grep -n "s.display === 'block'" src/layout/block-inline.ts` empty; `grep -c 'function isBlockLevel' src/layout/*.ts` = 1. Residual persists: `block-inline.ts` 3424 lines / 9 responsibilities; module globals `paintScPath` 491, `cbStack` 495, `clipStack` 505, `opacityStack` 522; `makeStyle` still spans ~990 lines | extract behind existing exports: style-resolve / paint-op / inline-format / block-flow (isBlockLevel done); thread the stacks. `makeStyle` splits per property-group | **registered** (gen-3 fix task `qa10-unify-block-display-skip` landed the isBlockLevel slice; gen-5 re-confirmed at HEAD — predicate at `block-inline.ts:860`, sites 886/905/957/2799, enum grep empty, count=1; residual = monolith extraction + stack threading + makeStyle split — **terminal at N=5**, the chain ends here) | 1 |
| QA-11 | medium | config | `safari.ts:34` hardcodes `/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf`, violating the stated no-home-dir policy (`chrome.ts` `fontPath` pattern; vendored copy exists at `fonts/HackNerdFont-Regular.ttf`); `chrome.ts:131` lists `'Droid Sans Japanese'` in scriptCoverage with no registration/fallback reference (verify, then remove); safari config is wired but has no verification loop (unlike firefox) — probe-only per charter §4 until WebKit oracle lands | fix-task HEAD re-verified: `src/config/safari.ts:34` hardcoded `/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf` persists (vs `chrome.ts:40` `fontPath(env, repoFile)` + vendored `fonts/HackNerdFont-Regular.ttf`); `src/config/chrome.ts:131` `'Droid Sans Japanese': ['Hani']` row present with no registration/fallback reference (`chrome.ts:83` registers Droid Sans Fallback; scriptFallback :115 maps Hani → Droid Sans Fallback); grep src/+scripts/ finds only that dead row + prose (`scripts/verify-text-measure.mjs:273` describes the cjk measure-corpus) | route through `fontPath(env, repoFile)`; drop dead row after grep-disproof of references; ledger marks safari probe-only | **fixed** (fix task `safari-config-fix` landed 2026-09-04 on this branch): (a) `fontPath` exported from `chrome.ts` (warn label generalized; safari resolves its fixed-pitch face through the same authority) and `safari.ts` mono face is now `fontPath(process.env.SAFARI_MONO_FONT, 'HackNerdFont-Regular.ttf')` — `grep "/home/sagi" src/` empty; the serialized safari config contains no `/home/` path and registers `Hack Nerd Font @ fonts/HackNerdFont-Regular.ttf` (relative to repo root); SAFARI_MONO_FONT override + absent-file fallback verified; (b) the dead `'Droid Sans Japanese'` scriptCoverage row removed from `chrome.ts` after grep-disproof — the remaining references are prose in verify-text-measure.mjs:273 describing the cjk measure-corpus (whose fixture `corpus/measure-corpus/cjk/fixture.json` registers its own `DroidSansJapanese.ttf`) and ledger data, none a chrome-config registration/fallback, so the row was unreachable (script-fallback consults coverage only for the active family, which can never be an unregistered face); (c) `docs/ledgers/safari.md` now marks the track probe-only per charter §4 with the QA-13 hand-mirror cross-reference. Verify: `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0 (105 matrix + 6 deferred rows); node one-liner importing `dist/index.js` prints `getBrowserConfig('safari')` and asserts no `/home` path; `npm run probe:browser-gap` exit 0 (documented WebKit-unavailable skip path — Chrome-vs-Firefox pairs + safari seam PASS); test:probe 52/52; verify:font-registration / verify:cross-family / verify:paint-fallback / verify:rtl all exit 0 | 1 |
| QA-12 | medium | code | measure/canvas seam duplication: alignment/justify block copy-pasted 3× inside `measure.ts` + once at block-inline; indent-mode logic duplicated; `skia.ts` duplicates its `measure`/`hasFamily` closures internally; `pretext/index.ts` constructs a **new `Intl.Segmenter` per call** on the hot measure path while `script-fallback.ts` holds a singleton; two font-shorthand parsers at the same seam; dead export `fontMetricsKey` | **fixed at gen-3 HEAD (fix task `qa12-unify-measure-seam` landed), re-confirmed gen-4:** `pretext/index.ts:130` holds a module singleton `graphemeSegmenter` (`grep -n "new Intl.Segmenter" src/pretext/index.ts` matches only the const decl); skia's duplicated `measure`/`hasFamily` closures extracted to two shared private arrow-field methods `measureWidth`/`hasFamily` serving both `measureText` (skia.ts:72,76) and `drawText` (skia.ts:155,157) (`grep -c "const measure\|const hasFamily" src/canvas/skia.ts` = 0, single bodies each); dead export `fontMetricsKey` deleted from `fontmetrics.ts` (zero read sites, `createHash` import gone). Residual registered (unchanged): the alignment/justify block (3× in `measure.ts` + once at block-inline), indent-mode logic (`measure.ts:346` `segIndent` vs `block-inline.ts:3104` `lineIndent`), and the two font-shorthand parsers (`script-fallback.ts:132` `parseFontShorthand` vs `pretext/index.ts:57` `resolveFontFamilyInShorthand`) — larger seam-crossing consolidations, see attempt log | one alignment/justify helper, one indent-mode helper, skia closures to private methods (done), one shared segmenter (done) + one shorthand parser in `canvas/` | **registered** (gen-3 fix task `qa12-unify-measure-seam` landed: segmenter singleton at `pretext/index.ts:130` + skia private `measureWidth`/`hasFamily` + dead-export removal; gen-5 re-confirmed — `grep -n "new Intl.Segmenter" src/pretext/index.ts` matches only the singleton decl, `grep -c "const measure\|const hasFamily" src/canvas/skia.ts` = 0, `rg -rn "fontMetricsKey" src/` empty; residual = alignment/justify + indent-mode + font-shorthand-parser consolidations — **terminal at N=5**, the chain ends here) | 1 |
| QA-13 | low-med | hygiene | Drift-prone edges: fallback tables hand-mirrored into 3 ledgers with no sync check and `chrome.ts` self-mapping rows appear in no ledger; config⇄canvas module cycle; barrel gaps; dead mode validation `tolerances.ts:81`; `media.ts:9-10` header claims `print` support but the evaluator drops `@media print`; ~17 zero-reader cascade exports + 5 unread pretext wrapper types + `SkiaCanvasFactory` class export unread | gen-4 pre-fix re-confirmed: `src/harness/tolerances.ts:81` was `x === 'exact' ? 'exact' : 'exact'`; `media.ts:9-10` header claimed `print` while evaluator `media.ts:486` returned all/screen only; `canvas/index.ts` omitted `measure-cache`, `cascade/index.ts` omitted `supports`; config⇄canvas cycle edge `browser-config.ts:13` → `canvas/measure-cache.js`. **Post-fix (task landing):** barrels completed — `canvas/index.ts:2` `export * from './measure-cache.js'` (ResolvedRun + cachedMetrics/cachedFamilyHas/cachedResolvedRuns/invalidateMeasureCache/getMeasureCacheMisses/resetMeasureCacheMisses), `cascade/index.ts:11` `export * from './supports.js'` (SupportsCondition + parseSupportsCondition/evaluateSupportsDeclaration/evaluateSupportsCondition), no name collisions; ternary collapsed to `mode: 'exact'` at `tolerances.ts:81` (`grep "computedStyleRaw.mode === 'exact'"` empty; single-literal type); media header now states all/screen only (`media.ts:10-12`) matching the evaluator at `:486` — `print` is parsed but never matches (static renderer has no print surface), and no corpus fixture exercises `print` | generated-or-asserted ledger tables (residual); registered invalidate callback breaks the config cycle (residual); barrel completion (done); validation fix (done); media claim correction (done); dead-export sweep batch (residual) | **registered** (fix task `qa13-drift-prone-edges` landed gen 4 — barrels completed, validation fixed, media claim corrected; gen-5 re-confirmed at HEAD: `canvas/index.ts:2` + `cascade/index.ts:11` barrels present, `tolerances.ts:81` `mode: 'exact'`, media header :10-12 agrees with evaluator :486; residual = config⇄canvas cycle, fallback-table ledger mirroring, zero-reader export sweep incl. SkiaCanvasFactory — **terminal at N=5**, the chain ends here — see attempt log) | 1 |
| QA-14 | low | scripts | Two font conventions across verify scripts: 44 read `FONT_FILE`/`FONT_FAMILY` env, 11 use `chromeConfig.defaultFamily/defaultFile`, 4 use neither — harvest setups are not interchangeable | gen-2: `scripts/lib/runner.mjs:24-25` now owns the single `FONT_FILE`/`FONT_FAMILY` convention (env override preserved) for the 3 migrated scripts; the remaining scripts still carry per-script constants, retired batch-by-batch on the QA-07 roadmap | fold into QA-07's runner (one convention, env override preserved) | **registered** (folded into QA-07; the runner centralizes the convention for migrated scripts, residual scripts migrate per the QA-07 roadmap — **terminal at N=5**, the chain ends here) | 1 |
| QA-15 | low | code | `LATIN_SAFE_RE` (`script-fallback.ts:157`) deliberately matches ASCII control characters (`\x00-\x7F`, intent documented inline); the TS language server flags it (`no-control-regex`-class diagnostic). Build is green today, but a future lint gate would fail on it | `src/canvas/script-fallback.ts:157` unchanged (`/^[\x00-\x7F\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\s]+$/u`); gen-4 HEAD still has **no lint/typecheck npm script** (`package.json` `"build": "tsc -p tsconfig.json"` only, zero lint scripts) — nothing can flag it today | verify-first: if no lint gate exists, the inline justification is already present — either wire an eslint-disable with reason or narrow the class if controls are unreachable in text content; only matters once a lint gate lands | open (gen-5 re-confirmed: `src/canvas/script-fallback.ts:157` unchanged — `/^[\x00-\x7F\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\s]+$/u`; package.json still has `"build": "tsc -p tsconfig.json"` only, zero lint scripts — nothing can flag it today). **FINAL at N=5**: open, terminal — the fix only matters once a lint gate lands, which no successor generation will now add | 0 |
| QA-16 | low | hygiene | No package lockfile committed: `pnpm install` resolves the `^` ranges to the newest available, so generated artifacts (candidate renders, timing ledgers) are not reproducible across environments | **disproven at gen-4 HEAD:** `package-lock.json` IS committed (tracked since a4d5a55, 2026-08-13, present at gen-3 HEAD cd18e34 and gen-4 HEAD 9523c2c) and pins all seven deps exactly — `@napi-rs/canvas` 1.0.5 (from `^1.0.5`), `typescript` 5.9.3 (from `^5.5.3`), `playwright` 1.62.1, `@types/node` 20.19.43, `pretext` 0.0.8, `css-tree` 3.2.1, `parse5` 7.3.0; README.md:13 documents `npm install`; the gen-3 registration's "git ls-files shows none" claim was factually wrong, and the QA-09-landing candidate.png byte drift was install-environment noise (verify PASS either way). The pnpm angle (no pnpm-lock.yaml) only bites if the environment installs via pnpm, which nothing in the repo documents | commit `pnpm-lock.yaml` (or exact-pin deps) so candidate/ledger artifacts are byte-reproducible across environments | **disproven** (gen-4 verification, evidence above; not re-opened at gen-5) | 0 |

## QA-07 residual roadmap (registered gen 2, per-batch, one corpus family each)

The runner + table family landed; 54 verify scripts remain. Each batch below is a
single context window: migrate the family onto `runVerify` (or the runner hook
it needs), keep `verify:all` green, then update this roadmap. The copy-count
ledger is tracked in the QA-07 attempt log; a batch is only "done" when its
scripts no longer define `fixtures()`/`textRegionMask()`.

- **Batch 1 — layout family (6, direct fit):** verify-layout-grid, verify-layout-floats,
  verify-layout-inline-block, verify-layout-positioning, verify-sticky, verify-overflow.
- **Batch 2 — cascade/selectors family (7, direct fit):** verify-selectors,
  verify-selectors-structural, verify-supports, verify-aspect-ratio,
  verify-display-contents, verify-pseudo-elements, verify-custom-properties.
- **Batch 3 — paint/box family (8, direct fit):** verify-paint-text, verify-backgrounds,
  verify-border-radius, verify-border-styles, verify-shadow, verify-opacity,
  verify-colors, verify-four-layer.
- **Batch 4 — text/unicode family (7, direct fit):** verify-text-align,
  verify-text-breaking, verify-text-formatting, verify-text-level-ua,
  verify-white-space, verify-unicode-bidi, verify-br-wbr.
- **Batch 5 — ua/computed family (2, direct fit):** verify-ua-styles,
  verify-form-controls (computedStyle-harvest shape, same as tables-collapse).
- **Batch 6 — stress/misc family (3, direct fit):** verify-stress, verify-lists,
  verify-firefox.
- **Special-shape tail (21, NOT a direct `runVerify` fit — need runner hooks or stay
  standalone):** verify-breaker, verify-calc, verify-comments, verify-cross-family,
  verify-font-registration, verify-layers, verify-legacy-removal, verify-measure-perf,
  verify-measure-persist, verify-media-modern, verify-media-queries, verify-outline,
  verify-paint-fallback, verify-paint-perf, verify-property-coverage,
  verify-rect-contract, verify-report, verify-rtl, verify-segmenter, verify-sweep,
  verify-text-measure. Each should be assessed on its own (perf/measure/sweep/calc
  pipelines differ); the runner only absorbs the four-layer harvest shape. QA-14's
  font-convention fold-in rides the batches above.

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
- Generation 2 (this branch, `qa01-break-tables-cycle` → `9ac5904`): the QA-01
  fix task landed (`tables.ts` `TableLayoutInput.availableInlineSize` threaded;
  `lastAvailableInlineSize` global + `setTableAvailableInlineSize` export
  deleted; `block-inline.ts` side-channel setter removed, `tableDefaultsFor`
  deleted, `StyleDefaults` trimmed; `cascade/ua.ts:118-122` table-tag UA rules
  added; `layout/css.ts` border-collapse declared-value handling) and the QA-02
  fix task landed (`src/layout/intrinsic.ts` shared module; flexbox/grid/tables/
  block-inline migrated to policy objects; dead `minimum` deleted). Both
  landings refreshed timing ledgers (icu, layers, sweep, text-measure) from real
  runs. The audit itself touched no product code: it re-verified all 15 rows
  (QA-02 → **fixed**, QA-04/QA-08/QA-10 drifted-further), created fix tasks
  `qa07-verify-runner` (QA-07) + `qa10-unify-block-display-skip` (QA-10 slice),
  and this successor `quality-audit-3`. The block-inline⇄tables import cycle
  remains the registered residual of QA-01.
- Generation 2 (this branch, `qa07-verify-runner`): the QA-07 fix task landed —
  `scripts/lib/runner.mjs` (shared four-layer pipeline: `fixtures`/`textRegionMask`/
  `harvestChrome`/`renderCandidate`/`exclusionMask`/`writeArtifacts`/`reportTail`/
  `runVerify`) and the table family migrated onto it (`verify-tables.mjs`,
  `verify-tables-collapse.mjs`, `verify-layout-flexbox.mjs` reduced to ~30-line
  `runVerify` imports). Timing ledgers (icu, layers, sweep, text-measure) refreshed
  by the real `verify:all` run at landing. QA-07 → **registered** (runner + table
  family; residual per-batch roadmap registered above); QA-14 → **registered**
  (folded into the runner). No product code touched; no new tasks created (the
  audit task owns the successor).
- Generation 3 (this branch, `qa10-unify-block-display-skip`): the QA-10
  isBlockLevel slice landed — one shared `isBlockLevel(display)` predicate in
  `src/layout/block-inline.ts` (exported) and the four display-skip list sites
  (`hasInlineContent`, `hasBlockLevelChild`, `collectInlineText`, `buildPieces`)
  migrated onto it with each caller's float/position variant preserved. Timing
  ledgers (icu, layers, sweep, text-measure) refreshed by the real `verify:all`
  run at landing. QA-10 → **registered** (predicate done; residual = monolith
  extraction + stack threading + makeStyle split). No product code touched
  outside the four sites; no new tasks created (the gen-2 audit's successor
  `quality-audit-3` owns the next chain step).

- Generation 3 (this branch, `quality-audit-3`, post-fix HEAD `cd18e34`): the
  audit itself touched no product code. It re-verified all 15 rows at
  post-fix HEAD: QA-07 + QA-10 re-confirmed **registered** (runner + table
  family; single `isBlockLevel` predicate), QA-02 fixed, QA-06 disproven (not
  re-opened), QA-01 registered (cycle residual), and QA-03/04/05/08/09/11/12/
  13/15 open with fresh file:line evidence (QA-09 + QA-12 gained fix tasks
  this generation). Created fix tasks `qa09-unify-cascade-parse-helpers`
  (QA-09) + `qa12-unify-measure-seam` (QA-12) and this successor
  `quality-audit-4`. Build + check-charter green at HEAD; verify:tables /
  verify:tables-collapse / verify:layout-flexbox re-run green here.

- Generation 3 (this branch, `qa09-unify-cascade-parse-helpers`): the QA-09
  slice landed — (a) `supports.ts`'s byte-clone `splitValue` deleted, its nine
  call sites moved onto the exported `css.ts:1018` `splitTopLevel` (the media.js
  token splitter aliased `splitTopLevelTokens`); (b) one shared selector-list
  splitter `splitSelectorList` (`selector.ts`, exported) now serves both the
  stylesheet parser (`stylesheet.ts`'s local `splitSelectors` deleted; the
  lenient empty-segment filter preserved at the call site) and `parseSelectorList`
  (strict empty-segment rejection preserved); (c) one aspect-ratio helper pair
  `parseRatio` + `compareAspectRatio` (`media.ts`, exported) serves both the
  @media and @container evaluators, preserving the b===0 guard — the container
  path's lenient 3-part `<ratio>` parse was unified onto media's strict
  Blink-correct grammar; (d) one media comparator `compareNum` (`media.ts`,
  exported) serves `phases/media-queries.ts` (local byte-identical `compare`
  deleted). The container-condition dialect parameterization was NOT attempted
  (explicitly out of scope) and is registered as the QA-09 residual. Timing
  ledgers (icu, layers, sweep, text-measure) refreshed by the real `verify:all`
  run at landing. A `corpus/custom-properties/inheritance/candidate.png` byte
  drift was investigated and found to be install-environment noise (reproduced
  with the src changes stashed, verify PASS either way) — reverted, not
  committed; the missing-lockfile root cause registered as QA-16. QA-09 →
  **registered** (helpers consolidated; residual = container-condition dialect
  parameterization). Build green; check-charter PASS; verify:supports /
  verify:aspect-ratio / verify:selectors / verify:selectors-structural /
  verify:media-queries / verify:media-modern / verify:custom-properties /
  verify:all all exit 0 at landing. No new tasks created (the gen-3 audit's
  successor `quality-audit-4` owns the next chain step).

- Generation 3 (this branch, `qa12-unify-measure-seam`): the QA-12 measure-seam
  slice landed — (a) `src/pretext/index.ts` `segmentGraphemes` now uses a
  module-level `graphemeSegmenter` singleton (matching script-fallback.ts:122 and
  css.ts:2840-2841) instead of constructing a new `Intl.Segmenter` on every call;
  (b) `src/canvas/skia.ts`'s duplicated `measure`/`hasFamily` closures
  (measureText vs drawText) extracted to two shared private arrow-field methods
  `measureWidth` + `hasFamily`, preserving the cachedMetrics / cachedFamilyHas /
  cachedResolvedRuns memoization exactly; (c) dead export `fontMetricsKey`
  deleted from `src/layout/fontmetrics.ts` together with its now-unused
  `createHash` import. Timing ledgers (icu, layers, sweep, text-measure) refreshed
  by the real `verify:all` run at landing. QA-12 → **registered** (segmenter
  singleton + skia private closures + dead-export removal done; residual =
  alignment/justify block, indent-mode logic, and font-shorthand-parser
  consolidations — see attempt log). Build green; check-charter PASS;
  verify:segmenter / verify:text-measure / verify:measure-perf /
  verify:measure-persist / verify:font-registration / verify:cross-family /
  verify:firefox / verify:all all exit 0 at landing. No new tasks created (the
  gen-3 audit's successor `quality-audit-4` owns the next chain step).
- Generation 4 (this branch, `quality-audit-4`, post-fix HEAD `9523c2c`): the
  audit itself touched no product code. It re-verified all 16 rows at
  post-fix HEAD: QA-09 + QA-12 re-confirmed **registered** (their gen-3 fix
  tasks landed — cascade parse helpers consolidated, measure seam unified),
  QA-02 stays fixed, QA-06 stays disproven (not re-opened), QA-01/QA-07/QA-10/
  QA-14 stay registered, and QA-03/04/05/08/11/13/15 re-confirmed open with
  fresh file:line evidence. **QA-16 → disproven** (package-lock.json is
  committed since a4d5a55 and pins all seven deps exactly; the gen-3
  "git ls-files shows none" premise was false). Created fix task
  `qa13-drift-prone-edges` (QA-13 — the highest-severity open finding without
  a pending fix task) and this successor `quality-audit-5`. Build +
  check-charter green at HEAD; verify:tables / verify:tables-collapse /
  verify:layout-flexbox / verify:supports / verify:aspect-ratio /
  verify:selectors / verify:media-queries / verify:media-modern /
  verify:custom-properties / verify:segmenter / verify:text-measure /
  verify:measure-perf / verify:measure-persist / verify:font-registration /
  verify:cross-family / verify:firefox all exit 0 at HEAD.
- Generation 4 (this branch, `qa13-drift-prone-edges`): the QA-13 mechanical
  hygiene slice landed — (a) barrels completed: `canvas/index.ts` now re-exports
  `measure-cache.js` (cachedMetrics/cachedFamilyHas/cachedResolvedRuns/
  invalidateMeasureCache/getMeasureCacheMisses/resetMeasureCacheMisses +
  `ResolvedRun`) and `cascade/index.ts` now re-exports `supports.js`
  (parseSupportsCondition/evaluateSupportsDeclaration/evaluateSupportsCondition +
  `SupportsCondition`), no name collisions (build green); (b) the dead ternary at
  `tolerances.ts:81` collapsed to a plain `mode: 'exact'` (the
  `ComputedStyleTolerance.mode` type is the single literal `'exact'`;
  `grep "computedStyleRaw.mode === 'exact'" src/harness/tolerances.ts` empty);
  (c) the `media.ts:9-10` `print` type-claim corrected: the evaluator at
  `media.ts:486` recognizes only all/screen, the static renderer has no print
  surface (`MediaEnvironment` carries no media type), and no corpus fixture
  exercises `print` — the header now states all/screen only (`media.ts:10-12`),
  matching behavior, so nothing pinned by the media-queries/media-modern corpora
  changed. Timing ledgers (icu, layers, sweep, text-measure) refreshed by the
  real `verify:all` run at landing. QA-13 → **registered** (mechanical slice
  done; residual = the config⇄canvas module cycle `browser-config.ts:13` →
  `canvas/measure-cache.js`, the hand-mirrored fallback-table ledger rows, and
  the ~17 zero-reader cascade exports + 5 unread pretext wrapper types +
  `SkiaCanvasFactory` — see attempt log). Build green; check-charter PASS;
  `npm run verify:all` exit 0 at landing. No new tasks created (residuals
  registered in the ledger per the fix-task scope; successor `quality-audit-5`
  owns the next chain step).
- Generation 5 (this branch, `quality-audit-5`, post-fix HEAD `39556aa`): the
  qa13-drift-prone-edges landing is the only product-code change since the
  gen-4 anchor — `src/canvas/index.ts` (+`export * from './measure-cache.js'`),
  `src/cascade/index.ts` (+`export * from './supports.js'`),
  `src/cascade/media.ts` (print-claim correction), `src/harness/tolerances.ts`
  (dead ternary collapsed); timing ledgers (icu, layers, sweep, text-measure)
  refreshed by the real verify:all run at that landing. The audit itself
  touched no product code: it re-verified all 16 rows at post-fix HEAD,
  re-confirmed QA-13 **registered** (its gen-4 fix task landed — barrels,
  ternary, media claim all verified at fresh line numbers), QA-02 fixed,
  QA-06 + QA-16 disproven (not re-opened), QA-01 open (cycle residual), and
  QA-03/04/05/08/11/15 open with fresh file:line evidence. **N=5 is the chain
  cap — NO successor `quality-audit-6` was created.** Every registry row
  received its FINAL disposition (open / fixed / disproven / retired) in this
  ledger; the residuals of QA-07/09/10/12/13/14 are recorded as terminal. Two
  fix tasks created this generation for the highest-severity verified open
  findings: `qa03-charter-deferred-enforcement` (QA-03 + QA-04 + QA-08 —
  extends check-charter to enforce the charter §11 Deferred table, regenerates
  coverage-matrix + parity from it) and `qa05-verify-gate-coverage` (QA-05 —
  wires the 9 unwired verify scripts into the gate, fixes the parity.md
  overclaim). Both supersede the stale gen-0 specs `charter-deferred-enforcement`
  / `verify-gate-coverage` (never dispatched across 5 generations). Build +
  check-charter green at HEAD (tsc, no errors; icu 78.3, node 26.8.1, 4 typed
  gap declarations).
- Generation 5 (this branch, `qa03-charter-deferred-enforcement`): the
  QA-03+QA-04+QA-08 fix task landed. `docs/charter.md` §11 Deferred prose
  restructured into a machine-checked Absent surface|Status|Evidence table (6
  rows, content preserved); `scripts/check-charter.mjs` extended to parse and
  enforce it (the matrix loop now stops at the `### Deferred` heading;
  comment-stripped token search for the Deferred tokens; `absent`/
  `declared-divergence` status checks with the ledger-citation rule; two
  deliberate-contradiction probes proven live and reverted); the coverage-matrix
  ledger's deferred table regenerated from the charter (opacity/shadow/calc/
  custom-props/@supports/@container/tables-collapse no longer EMPTY) and the
  "all 53 rows" claim corrected to 105 §11 data rows; parity.md's census
  rewritten from the real gap declarations (4 typed gaps — legacy-elements ×3 +
  regression-divergence ×1) and its Latest Run refreshed from the real
  2026-09-04 run of the touched corpora (verify:calc 7/7, verify:shadow 9/9,
  verify:opacity 5/5, verify:colors 4/4, verify:custom-properties 5/5, all exit
  0, date + command stated). QA-03/QA-04/QA-08 → **fixed**. No product code
  touched; no new tasks created (N=5 chain cap — no successor audit). Build
  green; check-charter PASS (105 matrix rows, 6 deferred rows enforced).
- Generation 5 (this branch, `qa05-verify-gate-coverage`): the QA-05 fix task
  landed. Re-verification at HEAD confirmed all three sub-findings: 9 scripts
  out of `verify:all`, verify-rtl.mjs + verify-paint-fallback.mjs with zero npm
  entries, and parity.md's Method claiming `npm run verify` renders every
  corpus fixture. Fix: the 8 environment-independent scripts wired into
  `verify:all` (verify-colors, verify-custom-properties, verify-legacy-removal,
  verify-rtl, verify-property-coverage, verify-measure-perf,
  verify-measure-persist, verify-paint-perf); verify-paint-fallback wired into
  a new documented `verify:extra` tier (its daemon-driven task-acceptance mode)
  reachable via the new `npm run verify:paint-fallback`; npm entries added for
  both previously-unwired scripts; parity.md's Method wording fixed (`verify:all`
  = full gate, `verify` = fast subset — wording only; the census/Latest Run
  numbers are qa03's real-run output, untouched). The property-coverage ledger
  was regenerated by the real run (374 → 409 fixtures audited); a
  `corpus/custom-properties/inheritance/candidate.png` byte drift was reverted
  as install-environment noise (the QA-09 precedent). QA-05 → **fixed**. No
  product code touched; no new tasks created (N=5 chain cap — no successor
  audit). Build green; check-charter PASS; `npm run verify:all` exit 0 including
  the newly wired scripts; shell enumeration closure — every
  scripts/verify-*.mjs filename appears in package.json.
- Generation (this branch, `safari-config-fix`): the QA-11 fix task landed (the
  gen-0 spec dispatched at gen-5 close, per its registry-row note). (a)
  `src/config/chrome.ts`: `fontPath` exported (warn label generalized) as the
  shared no-home-dir path-resolution authority; the dead `'Droid Sans
  Japanese': ['Hani']` scriptCoverage row removed after grep-disproof. (b)
  `src/config/safari.ts`: the hardcoded `/home/sagi/...` mono path replaced by
  `fontPath(process.env.SAFARI_MONO_FONT, 'HackNerdFont-Regular.ttf')` — env
  override first, then the vendored copy registered relative to the repo root,
  absent ⇒ face omitted and the fallback table handles the generic, exactly
  like chrome.ts. (c) `docs/ledgers/safari.md`: probe-only note (charter §4,
  WebKit oracle parked) + QA-13 hand-mirror cross-reference. QA-11 → **fixed**.
  Timing ledgers unaffected (no timing-sensitive code touched; the timing
  verify scripts consume no config registration). Build green; check-charter
  PASS (105 matrix + 6 deferred rows); `npm run probe:browser-gap` exit 0
  (documented WebKit-unavailable skip path — Chrome-vs-Firefox pairs + safari
  seam PASS); test:probe 52/52; verify:font-registration / verify:cross-family
  / verify:paint-fallback / verify:rtl all exit 0 at landing. No new tasks
  created (chain task, not the audit — no successor).

## Attempt log (appended per generation; feeds the ≥10 retirement rule)

| Finding | Task | Generation | Attempt # | Approach | Outcome + reason |
| --- | --- | --- | --- | --- | --- |
| QA-06 | (none — verification, not a task attempt) | 1 | 0 | verify-first re-check of the sRGB coefficient drift against HEAD | disproven — intentional: `paint.ts:215-222` is a documented WCAG relative luminance (rounded 0.2126/0.7152/0.0722) for the inset/outset border heuristic; `deltaE.ts:38-53` is a full CIE XYZ→Lab matrix (0.2126729/0.7151522/0.072175) for ΔE\*ab. Different formulas, each correct; shared `srgbToLinear` curve is a hygiene nit only. No fix task created. |
| QA-01 | `qa01-break-tables-cycle` | 2 | 1 | Re-verify at HEAD, then (a) thread the available inline size through `TableLayoutInput.availableInlineSize` and delete the `setTableAvailableInlineSize`/`lastAvailableInlineSize` side channel; (b) move `tableDefaultsFor` into `cascade/ua.ts` table-tag rules and delete the monolith copy; (c) assess breaking the block-inline⇄tables import cycle | (a) and (b) landed and verified: `grep -rn "setTableAvailableInlineSize\|lastAvailableInlineSize" src/` empty; `grep -n "tableDefaultsFor" src/layout/block-inline.ts` empty; table UA rules at `cascade/ua.ts:118-122`; verify:tables + verify:tables-collapse + verify:ua-styles + verify:text-level-ua all PASS. (c) registered residual — breaking the cycle needs extracting `layoutElementBox` plus its transitive deps (`pushPaintOp`, `buildPieces`, `expandContents`, `FloatManager`, the paint/positioned/opacity stack globals, fieldset/inline-content children) into a shared layout module, a multi-thousand-line extraction beyond one context window; left for a future generation. |
| QA-02 | `qa02-unify-intrinsic-sizing` | 2 | 1 | Re-verify at HEAD, then expand-contract: shared `src/layout/intrinsic.ts` module exposing content-intrinsic helpers parameterized by policy (display-skip set, space measurement, break handling, border-box, positioned/float skip), migrate flexbox/grid/tables/block-inline in batches with `verify:all` green per batch, delete the four local copies and the dead `minimum` field | landed and verified at gen-2 HEAD: `intrinsic.ts` (298 lines) is the single definition site (`contentInlineSizes` at `intrinsic.ts:246`); the four callers import from `./intrinsic.js` with policy objects preserving every drift axis (`flexbox.ts:53-62`, `grid.ts:42-51`, `tables.ts:59-70`, `block-inline.ts:2654`); `grep "\.minimum" src/layout/grid.ts` empty; `npm run verify:all` exit 0 at landing, build + check-charter green. Fixed. |
| QA-07 (+ QA-14) | `qa07-verify-runner` | 2 | 1 | Re-verify at HEAD, then consolidate the duplicated per-script pipeline (fixtures walker, `textRegionMask`, Chrome-harvest block, report tail) into `scripts/lib/runner.mjs` and migrate the table family (verify-tables + verify-tables-collapse + verify-layout-flexbox) as the proof batch; register the residual as a per-batch roadmap | landed and verified. **Re-verification evidence (gen-2 HEAD, pre-migration):** `textRegionMask` defined in 36 scripts (`scripts/verify-tables.mjs:59`, `scripts/verify-tables-collapse.mjs:58`, `scripts/verify-layout-flexbox.mjs:59`, +33 more); `function* fixtures()` walker in 51 scripts (`scripts/verify-tables.mjs:40`, `verify-tables-collapse.mjs:39`, `verify-layout-flexbox.mjs:40`, +48 more); Chrome-launch harvest block in 52 scripts; `verify-tables.mjs` vs `verify-layout-flexbox.mjs` byte-identical except corpus path + fixture-set label + header (24 diff lines, the ledger's "14 lines" — both 241-line). **Migration:** `scripts/lib/runner.mjs` (293 lines) exposes `fixtures(corpus)`, `textRegionMask`, `harvestChrome` (computedStyle driven by `harvest.computedStyle` presence), `renderCandidate`, `exclusionMask`, `writeArtifacts`, `reportTail`, `runVerify`. The three scripts are now `runVerify` imports. **Closure:** `grep 'from \x27./lib/\x27' scripts/verify-tables.mjs scripts/verify-tables-collapse.mjs` non-empty; `grep 'function textRegionMask' scripts/verify-tables.mjs scripts/verify-tables-collapse.mjs` empty; copy counts strictly down (textRegionMask 36→33, fixtures walker 51→48). `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0; `npm run verify:tables`, `verify:tables-collapse`, `verify:layout-flexbox`, `verify:all` all exit 0 at landing; per-fixture console lines byte-identical to the pre-migration scripts. Registered (not fixed): residual = 54 scripts, roadmap above. QA-14 folds into the runner (single `FONT_FILE`/`FONT_FAMILY` convention at `runner.mjs:24-25`). |
| QA-10 | `qa10-unify-block-display-skip` | 3 | 1 | Re-verify at HEAD, then consolidate the four display-skip list sites in `block-inline.ts` onto ONE shared `isBlockLevel(display)` predicate, preserving each caller's float/position variant (three distinct variants); do not attempt the full monolith extraction or stack threading in this window | **Re-verification evidence (gen-3 HEAD, pre-fix):** the four lists with term drift were still present — `block-inline.ts:872` (block/li/grid/flex/table + float), `888` (+ position), `937` (neither), `2777` (+ float + position). QA-10 confirmed open (not disproven). **Fix:** `isBlockLevel(display)` added + exported at `block-inline.ts:860`; the four sites migrated at 886 (`hasInlineContent`, +float), 905 (`hasBlockLevelChild`, +float+position), 957 (`collectInlineText`, neither), 2799 (`buildPieces`, +float+position). **Closure:** `grep -n "s.display === 'block'" src/layout/block-inline.ts` empty (enumerations live only inside the predicate); `grep -c 'function isBlockLevel' src/layout/*.ts` = 1. `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0; `npm run verify:all` exit 0 at landing (incl. verify:layout-flexbox / layout-grid / layout-inline-block / layout-positioning / layout-floats / tables / tables-collapse). Registered (not fixed): residual = the monolith extraction (style-resolve / paint-op / inline-format / block-flow), stack threading, and the makeStyle split. No new tasks created. |
| QA-07 | (none — verification, not a task attempt) | 3 | 0 | gen-3 re-verification of the qa07-verify-runner landing at post-fix HEAD | re-confirmed registered: `scripts/lib/runner.mjs` (286 lines) is the single shared pipeline; the three migrated scripts are ~28-line `runVerify` imports with no local `textRegionMask`/`fixtures` definitions; copy counts across scripts/*.mjs strictly down (textRegionMask 36→33, fixtures walker 51→48); verify:tables / verify:tables-collapse / verify:layout-flexbox exit 0 here. Residual unchanged: 54-script per-batch roadmap in the ledger. No new task created (already registered). |
| QA-10 | (none — verification, not a task attempt) | 3 | 0 | gen-3 re-verification of the qa10-unify-block-display-skip landing at post-fix HEAD | re-confirmed registered: `isBlockLevel(display)` at `block-inline.ts:860` (exported); the four display-skip sites migrated at 886 (`hasInlineContent`, +float), 905 (`hasBlockLevelChild`, +float+position), 957 (`collectInlineText`, neither), 2799 (`buildPieces`, +float+position); `grep -n "s.display === 'block'" src/layout/block-inline.ts` empty; `grep -c 'function isBlockLevel' src/layout/*.ts` = 1. Residual unchanged: monolith extraction + stack threading + makeStyle split. No new task created (already registered). |
| QA-09 | `qa09-unify-cascade-parse-helpers` | 3 | 1 | Re-verify at HEAD, then consolidate the four duplication pairs onto ONE shared helper each — (a) delete supports.ts's `splitValue`, import the exported `css.ts:1018` `splitTopLevel`; (b) one selector-list splitter (migrate `stylesheet.ts:135` `splitSelectors` onto a shared splitter both call); (c) one aspect-ratio comparator (merge `media.ts:301`/`:370` and `phases/media-queries.ts:103-108`, preserving the b===0 guard); (d) one media comparator (merge `media.ts:326` `compareNum` and `phases/media-queries.ts:133` `compare`). Do NOT attempt the container-condition dialect parameterization (registered residual). | **Re-verification evidence (gen-3 HEAD, pre-fix):** all four pairs present — `supports.ts:27` `splitValue` byte-clone of the now-exported `css.ts:1018` `splitTopLevel` (supports.ts:25-26 comment stale, saying "css.ts's private splitTopLevel"); `stylesheet.ts:135` `splitSelectors` vs `selector.ts:422` `parseSelectorList` (identical depth/quote/bracket walk); `media.ts:301` `parseRatio` + inline aspect-ratio block at :369-394 vs `phases/media-queries.ts:102-131` (re-parses via split/parseFloat); `media.ts:326` `compareNum` vs `phases/media-queries.ts:133` `compare` (byte-identical switches). QA-09 confirmed open (not disproven). **Fix:** all four consolidated — (a) `splitValue` deleted, nine call sites now use the css.ts import (media.js token splitter aliased `splitTopLevelTokens`); (b) `splitSelectorList` exported from `selector.ts`, `stylesheet.ts` `splitSelectors` deleted (call site keeps `.filter(Boolean)`); (c) `parseRatio` + `compareAspectRatio` exported from `media.ts`, both evaluators call them (b===0 guard preserved; container's lenient 3-part parse unified onto media's strict Blink-correct `<ratio>` grammar, why-comment on `parseRatio`); (d) `compareNum` exported from `media.ts`, `phases/media-queries.ts` local `compare` deleted. **Closure:** `grep -n "function splitValue" src/cascade/supports.ts` empty; `grep -c "function parseRatio" src/cascade/*.ts src/cascade/phases/*.ts` = 1 (media.ts); `grep -c "function compareNum\|function compare(" src/cascade/*.ts src/cascade/phases/*.ts` = 1 (media.ts); `grep -c "function splitSelectorList" src/cascade/*.ts` = 1 (selector.ts); `function splitSelectors` empty in stylesheet.ts. `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0; verify:supports / verify:aspect-ratio / verify:selectors / verify:selectors-structural / verify:media-queries / verify:media-modern / verify:custom-properties / `verify:all` all exit 0 at landing. Registered (not fixed): the container-condition dialect parameterization (the parallel media-grammar with its hand-maintained Blink-correct `==` divergence) — the requirement explicitly kept it out of this window; registered as the QA-09 residual. New QA-16 registered (missing lockfile → artifact reproducibility, evidenced by the candidate.png drift reproduced with src stashed). No new tasks created (quality-audit-4 owns the next chain step). |
| QA-12 | `qa12-unify-measure-seam` | 3 | 1 | Re-verify at HEAD, then (a) hoist the per-call `Intl.Segmenter` at `pretext/index.ts:135` to a module singleton; (b) extract the duplicated `measure`/`hasFamily` closures in `skia.ts` (measureText 57-64 vs drawText 143-147) into shared private methods, preserving cachedFamilyHas/cachedMetrics memoization; (c) delete the dead export `fontMetricsKey`; register the alignment/justify, indent-mode, and font-shorthand-parser consolidations as residual if they exceed one context window | **Re-verification evidence (gen-3 HEAD, pre-fix):** per-call `new Intl.Segmenter` at `pretext/index.ts:135` (vs `script-fallback.ts:122` + `css.ts:2840-2841` singletons); identical `measure`/`hasFamily` closures at `skia.ts:57-64` vs `143-147`; `fontMetricsKey` at `fontmetrics.ts:88` with zero read sites. QA-12 confirmed open (not disproven). **Fix:** `graphemeSegmenter` module singleton at `pretext/index.ts:130` (per-call construction gone); skia `measureWidth`/`hasFamily` private arrow-field methods (single bodies each) now serve both `measureText` and `drawText`, with the cachedMetrics/cachedFamilyHas/cachedResolvedRuns calls unchanged so memoization semantics are byte-identical; `fontMetricsKey` and its now-unused `createHash` import deleted from `fontmetrics.ts`. **Closure:** `grep -n "new Intl.Segmenter" src/pretext/index.ts` matches only the singleton decl; `grep -c "const measure\|const hasFamily" src/canvas/skia.ts` = 0; `grep -rn "fontMetricsKey" src/` empty. `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0; verify:segmenter (72/72 ICU grapheme parity), verify:text-measure (96/96), verify:measure-perf, verify:measure-persist (0 canvas measureText calls warm), verify:font-registration, verify:cross-family, verify:firefox, and `npm run verify:all` all exit 0 at landing; timing ledgers icu/layers/sweep/text-measure refreshed by the real runs. Registered (not fixed): residual = the alignment/justify block (3× in `measure.ts` + once at block-inline), the indent-mode logic (`measure.ts:344` `segIndent` vs `block-inline.ts:3104` `lineIndent`), and the two font-shorthand parsers (`script-fallback.ts:132` `parseFontShorthand` vs `pretext/index.ts:57` `resolveFontFamilyInShorthand`) — larger seam-crossing consolidations deliberately out of scope this window. No new tasks created. |
| QA-09 | (none — verification, not a task attempt) | 4 | 0 | gen-4 re-verification of the qa09-unify-cascade-parse-helpers landing at post-fix HEAD | re-confirmed registered: `splitValue` gone from `supports.ts` (nine call sites at supports.ts:114-307 import the exported `css.ts:1018` `splitTopLevel`); `splitSelectorList` single at `selector.ts:429` (`stylesheet.ts:304` imports it, local `splitSelectors` deleted); `parseRatio` + `compareAspectRatio` single at `media.ts` (`grep -c "function parseRatio"` = 1); `compareNum` single at `media.ts:356` (`phases/media-queries.ts` local `compare` deleted, `grep -c` = 1); `grep -n "function splitValue" src/cascade/supports.ts` empty; `grep -c "function splitSelectorList" src/cascade/*.ts` = 1. Residual unchanged: the container-condition dialect parameterization (media.ts:21-22 documents the `==` Blink divergence, tokenized but rejected for @media, accepted only inside @container). verify:supports / verify:aspect-ratio / verify:selectors / verify:selectors-structural / verify:media-queries / verify:media-modern / verify:custom-properties / verify:tables / verify:tables-collapse / verify:layout-flexbox all exit 0 here. No new task created (already registered). |
| QA-12 | (none — verification, not a task attempt) | 4 | 0 | gen-4 re-verification of the qa12-unify-measure-seam landing at post-fix HEAD | re-confirmed registered: `graphemeSegmenter` module singleton at `pretext/index.ts:130` (`grep -n "new Intl.Segmenter" src/pretext/index.ts` matches only the const decl); skia shared private `measureWidth`/`hasFamily` methods (`grep -c "const measure\|const hasFamily" src/canvas/skia.ts` = 0) serving both `measureText` (skia.ts:72,76) and `drawText` (skia.ts:155,157); `fontMetricsKey` zero read sites (rg empty) and the unused `createHash` import deleted from `fontmetrics.ts`. Residual unchanged: alignment/justify block (3× in `measure.ts` + once at block-inline), indent-mode (`measure.ts:346` `segIndent` vs `block-inline.ts:3104` `lineIndent`), font-shorthand parsers (`script-fallback.ts:132` vs `pretext/index.ts:57`). verify:segmenter / verify:text-measure / verify:measure-perf / verify:measure-persist / verify:font-registration / verify:cross-family / verify:firefox all exit 0 here. No new task created (already registered). |
| QA-16 | (none — verification, not a task attempt) | 4 | 0 | gen-4 verify-first re-check of the registered lockfile-reproducibility finding | disproven — premise false: `git ls-files package-lock.json` is non-empty (tracked since a4d5a55, 2026-08-13; present at gen-3 HEAD cd18e34 and gen-4 HEAD), and the lockfile pins all seven deps exactly (@napi-rs/canvas 1.0.5, typescript 5.9.3, playwright 1.62.1, @types/node 20.19.43, pretext 0.0.8, css-tree 3.2.1, parse5 7.3.0). README.md:13 documents `npm install`. The gen-3 registration's "git ls-files shows none" was a misread (only pnpm-lock.yaml is absent, and pnpm is not the documented install path), and the candidate.png byte drift was install-environment noise (verify PASS either way). No fix task created. |
| QA-13 | `qa13-drift-prone-edges` | 4 | 1 | Re-verify at HEAD, then (a) complete the canvas/cascade barrels (`export * from './measure-cache.js'` + `export * from './supports.js'`); (b) collapse the dead ternary at `tolerances.ts:81` to `mode: 'exact'`; (c) reconcile the `media.ts:9-10` `print` claim with the evaluator at `:486`; (d) register the out-of-scope residuals (config⇄canvas cycle, fallback-table ledger mirroring, zero-reader export sweep) in the QA-13 registry row | **Re-verification evidence (gen-4 HEAD, pre-fix):** `canvas/index.ts` (4 exports) omitted `measure-cache`; `cascade/index.ts` omitted `supports`; `tolerances.ts:81` was `computedStyleRaw.mode === 'exact' ? 'exact' : 'exact'`; `media.ts:9-10` claimed `print` while the evaluator at `media.ts:486` returns only `cond.value === 'all' || cond.value === 'screen'`. All three sub-items confirmed open (none disproven). **Fix:** (a) both barrel lines added — no name collisions (measure-cache exports `ResolvedRun` + 6 functions, supports exports `SupportsCondition` + 3 functions, all disjoint from the existing barrel names; build green); (b) ternary collapsed to `mode: 'exact'` (`ComputedStyleTolerance.mode` is the single literal `'exact'`, so behavior is byte-identical; `grep "computedStyleRaw.mode === 'exact'" src/harness/tolerances.ts` empty); (c) header corrected to state all/screen only (`media.ts:10-12`): `print` is parsed but never matches because the static renderer has no print surface (`MediaEnvironment` has no media type) and the media-queries/media-modern corpora exercise no `print` (grep empty) — a claim/comment correction, no matching behavior changed. **Closure:** `grep -n "measure-cache" src/canvas/index.ts` non-empty (line 2); `grep -n "supports" src/cascade/index.ts` non-empty (line 11); ternary grep empty; media header :10-12 agrees with evaluator :486. `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0; `npm run verify:all` exit 0 at landing (incl. verify:media-queries / verify:media-modern / verify:supports / verify:custom-properties / verify:segmenter / verify:text-measure); timing ledgers icu/layers/sweep/text-measure refreshed by the real run. Registered (not fixed — larger/design-y, per fix-task scope): residual = the config⇄canvas module cycle (`browser-config.ts:13` → `canvas/measure-cache.js`), the hand-mirrored fallback-table ledger rows with no sync check, and the ~17 zero-reader cascade exports + 5 unread pretext wrapper types + `SkiaCanvasFactory`. No new tasks created. |
| QA-13 | (none — verification, not a task attempt) | 5 | 0 | gen-5 re-verification of the qa13-drift-prone-edges landing at post-fix HEAD | re-confirmed registered: `canvas/index.ts:2` `export * from './measure-cache.js'` + `cascade/index.ts:11` `export * from './supports.js'` (barrels complete, no name collisions); `tolerances.ts:81` is `mode: 'exact'` (`grep "computedStyleRaw.mode === 'exact'" src/harness/tolerances.ts` empty); media header `media.ts:10-12` states all/screen only, agreeing with the evaluator at `media.ts:486`; residuals unchanged — config⇄canvas cycle (`browser-config.ts:13` → `canvas/measure-cache.js`), hand-mirrored fallback-table ledger rows, zero-reader export sweep incl. `SkiaCanvasFactory`. `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0 (4 typed gap declarations) here. No new task created (already registered; residuals terminal at N=5). |
| QA-03 (+ QA-04 + QA-08) | `qa03-charter-deferred-enforcement` | 5 | 1 | Re-verify at HEAD, then (a) restructure charter §11 Deferred prose into a parseable table (Absent surface | Status | Evidence) preserving every claim; (b) extend check-charter.mjs to assert token presence/absence per status, proven with a deliberate-contradiction probe; (c) regenerate coverage-matrix.md's deferred table from the new schema + correct the stale "all 53 rows" claim; (d) refresh parity.md's census + Latest Run from real runs | **Re-verification at gen-5 HEAD (this run):** QA-03 confirmed open (check-charter.mjs parses only the §11 matrix, charter.md §11 Deferred section unenforced); QA-04 confirmed open (coverage-matrix.md deferred table still lists opacity/shadow/calc/custom-props as EMPTY vs charter §11 implemented=yes; "all 53 rows" stale); QA-08 confirmed open (parity.md census lists the flipped-to-`pass` container-gap, omits legacy-elements' 3 typed gaps, "Current count: 2" vs check-charter's 4; Latest Run 2026-08-14/17). **Fix:** (a) Deferred prose → 6-row table (Absent surface | Status | Evidence; statuses `absent`/`declared-divergence`), every claim's content preserved; (b) check-charter parses the table and enforces it — the matrix loop now stops at the `### Deferred` heading, `tokenInSourceCode` searches comment-stripped source, `absent` tokens must not appear, `declared-divergence` tokens must appear AND cite a `docs/ledgers/*.md` doc; two deliberate-contradiction probes (flip `border-collapse` row to `absent` → exit 1 "token found"; flip `@import` row to `declared-divergence` → exit 1 "token not found") both reverted after proving the seam; (c) coverage-matrix.md deferred table regenerated from the charter (opacity/shadow/calc/custom-props/@supports/@container/tables-collapse no longer listed as EMPTY; still-deferred surfaces mirror the charter table), "all 53 rows" → **105** §11 data rows (the count check-charter prints — the gen-5 audit's "106" had counted the header row); (d) parity.md census rewritten from the real gap declarations (4 typed gaps: `legacy-removal/legacy-elements` ×3 + `harness-tolerances/regression-divergence` ×1; container-gap's retired `pass` noted) + Latest Run refreshed from a real 2026-09-04 run of the touched corpora (`npm run verify:calc` 7/7, `verify:shadow` 9/9, `verify:opacity` 5/5, `verify:colors` 4/4, `verify:custom-properties` 5/5 — all exit 0, date + command stated). Fixed. No successor audit (N=5 chain cap). |
| QA-05 | `qa05-verify-gate-coverage` | 5 | 1 | Re-verify at HEAD, then (a) enumerate scripts/verify-*.mjs vs package.json; (b) wire every environment-independent verify script into verify:all (or a documented tier — never leave a script unwired); (c) add npm entries for verify:rtl + verify:paint-fallback; (d) fix the parity.md:24 overclaim (wording only, numbers from real runs) | **Re-verification at gen-5 HEAD (this run):** QA-05 confirmed open — 9 scripts out of verify:all (verify-colors, verify-custom-properties, verify-legacy-removal, verify-measure-perf, verify-measure-persist, verify-paint-fallback, verify-paint-perf, verify-property-coverage, verify-rtl; shell enumeration vs package.json); verify-rtl.mjs + verify-paint-fallback.mjs with zero npm entries; the other 7 have named entries but are out of verify:all; parity.md Method still said "`npm run verify` ... renders every corpus fixture". **Fix:** (a) all 8 environment-independent scripts wired into `verify:all` — the 7 named ones (colors, custom-properties, legacy-removal, property-coverage, measure-perf, measure-persist, paint-perf) plus verify-rtl (a corpus parity gate over corpus/rtl-layout that needs only Chrome, which the gate provides); (b) verify-paint-fallback wired into a new documented `verify:extra` tier (its daemon-driven task-acceptance mode — the gate exists to stop no-op archives of paint-run-fallback, not as a general parity gate), reachable via the new `npm run verify:paint-fallback`; (c) npm entries added for verify:rtl + verify:paint-fallback (both previously zero); (d) parity.md Method wording fixed: `verify:all` is the full gate, `verify` its fast subset — wording only, no ledger numbers hand-edited (the census/Latest Run are qa03's real-run numbers, untouched). **Closure:** shell enumeration — every scripts/verify-*.mjs filename appears in package.json (directly or via verify:extra); `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0 (105 matrix + 6 deferred rows); `npm run verify:all` exit 0 including the 8 newly wired scripts; property-coverage ledger regenerated by the real run (374 → 409 fixtures audited) — a corpus/custom-properties/inheritance/candidate.png byte drift was reverted as install-environment noise (the QA-09 precedent: reproduced with src stashed, verify PASS either way). Fixed. |
| QA-11 | `safari-config-fix` | 5 | 1 | Re-verify at HEAD, then (a) route the safari mono face through the chrome.ts `fontPath` authority (SAFARI_MONO_FONT env override → vendored `fonts/HackNerdFont-Regular.ttf` registered relative to the repo root, absent file ⇒ face omitted and the fallback table handles the generic); (b) remove the dead `'Droid Sans Japanese'` scriptCoverage row only after grep-disproof; (c) mark the safari track probe-only in docs/ledgers/safari.md per charter §4 with the QA-13 cross-reference; (d) update this ledger (QA-11 status + attempt log + touched areas). Chain task, not the audit: no successor; follow-up tasks only for new findings | **Re-verification at HEAD (this run):** QA-11 confirmed open — `safari.ts:34` hardcodes `/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf`; `chrome.ts:131` `'Droid Sans Japanese': ['Hani']` row present. Grep of src/+scripts+corpus+ledgers for 'Droid Sans Japanese': the dead row, prose in `scripts/verify-text-measure.mjs:273` (describes the cjk measure-corpus), the corpus fixture's own face (`corpus/measure-corpus/cjk/fixture.json` registers `DroidSansJapanese.ttf` with its own file), and ledger data (`docs/ledgers/text-measure.md` rows) — **no registration/fallback reference in the chrome config**, so the row is unreachable (script-fallback consults `scriptCoverage[active]` only for the active family, which can never be an unregistered face). **Fix:** (a) `fontPath` exported from `chrome.ts` (warn label generalized), safari mono face now `fontPath(process.env.SAFARI_MONO_FONT, 'HackNerdFont-Regular.ttf')`; (b) dead row removed; (c) safari.md probe-only note + QA-13 cross-ref. **Closure:** `grep "/home/sagi" src/` empty (only the gate's own doc-comment in verify-font-registration.mjs:14 remains, describing its acceptance rule); `grep "Droid Sans Japanese" src/` empty; the serialized safari config registers `Hack Nerd Font @ fonts/HackNerdFont-Regular.ttf` with no `/home` path; SAFARI_MONO_FONT override (existing file → absolute used; missing file → warn + fallback) verified. `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0 (105 matrix + 6 deferred rows); node one-liner importing `dist/index.js` prints `getBrowserConfig('safari')` and asserts no `/home` path; `npm run probe:browser-gap` exit 0 (documented WebKit-unavailable skip path — Chrome-vs-Firefox pairs + safari seam PASS, mean Δ 0.0083–0.0149px); test:probe 52/52; verify:font-registration / verify:cross-family / verify:paint-fallback / verify:rtl all exit 0. Fixed. |
| QA-05 | `verify-gate-coverage` (gen-0 spec — dispatched post-`qa05-verify-gate-coverage` landing) | 5 | 2 | Re-verify at HEAD per the verify-first rule: enumerate scripts/verify-*.mjs and cross-check each against package.json (verify:all + named scripts + the documented `verify:extra` tier); if everything is already wired, record the disproof in this ledger and finish — no manufactured changes, no silent drop | **disproven at HEAD — already fixed by `qa05-verify-gate-coverage` (19e8432):** shell enumeration shows all 57 scripts/verify-*.mjs are reachable from package.json — 8 environment-independent (colors, custom-properties, legacy-removal, rtl, property-coverage, measure-perf, measure-persist, paint-perf) inside `verify:all`; verify-paint-fallback via `verify:extra` → `npm run verify:paint-fallback` (tier documented at README.md:17-18); verify-sweep via `verify:sweep` (generate-sweep + verify-sweep); npm entries exist for both previously-unwired scripts (verify:rtl + verify:paint-fallback); parity.md:10 already reads "`npm run verify:all` — the full gate (`npm run verify` is its fast subset)". No code or gate changes made. **Verification re-run this dispatch:** `npm run build` exit 0; `node scripts/check-charter.mjs` exit 0 (icu 78.3, node 26.8.1, 4 typed gap declarations, 105 matrix + 6 deferred rows); `npm run verify:all` exit 0 including the 8 newly wired scripts (verify-colors 4/4, verify-custom-properties 5/5, verify-legacy-removal 1/1 with its documented typed gaps, verify-rtl 6/6 worst rect max Δ 0.006px, verify-property-coverage 409 fixtures/74 declared/61 recognized/13 ignored, verify-measure-perf, verify-measure-persist, verify-paint-perf all PASS). QA-05 stays **fixed**. |
