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
- **Status vocabulary:** `open` / `fixed` / `disproven` / `retired` (≥10
  attempts, see protocol §5) / `registered` (recorded for a future generation).

## Findings registry

| ID | Sev | Area | Finding | Evidence (gen-3 HEAD cd18e34) | Fix direction | Status | Attempts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-01 | high | arch | `block-inline.ts` ⇄ `tables.ts` runtime import cycle plus a side-channel global: tables.ts exports `setTableAvailableInlineSize` which block-inline sets as a side effect of width resolution; table UA defaults live in the layout monolith (`tableDefaultsFor`) while all other UA decls come from `cascade/ua.ts` (split-brain) | gen-2: side channel + UA split-brain **fixed** — `grep -rn "setTableAvailableInlineSize\|lastAvailableInlineSize" src/` empty; `grep -n "tableDefaultsFor" src/layout/block-inline.ts` empty; table-tag UA rules at `cascade/ua.ts:118-122`. Residual persists: `block-inline.ts:31` → `tables.js` and `tables.ts:48` → `block-inline.js` (mutual import edge unchanged) | tables receives an injected width context/callback instead of importing the monolith; move table UA defaults into `cascade/ua.ts` (both done) — residual cycle: extract `layoutElementBox` + transitive deps into a shared layout module | **registered** (gen-2 fix task `qa01-break-tables-cycle` landed: side channel eliminated, UA defaults moved; gen-3 re-confirmed — cycle edge unchanged at `block-inline.ts:31` → `tables.js` and `tables.ts:48` → `block-inline.js` — see attempt log) | 1 |
| QA-02 | high | code | Intrinsic-sizing helpers quadruplicated across flexbox/grid/tables/block-inline **with real drift**: grid skips `display:table` children where flex does not; flex skips `position:absolute/fixed` where grid does not; flex honors `box-sizing:border-box` via `borderBox()` where grid reads `style.width.px` raw; tables measures collapsed spaces with one `spaceW` vs block-inline per-piece run style; tables caps max at `break` pieces vs block-inline skipping breaks. Plus the dead `minimum` return field on `inlineContributions` | **fixed** at gen-2 HEAD: one shared module `src/layout/intrinsic.ts` with policy knobs for all five drift axes (`IntrinsicPolicy`/`PieceSizingPolicy`); four callers import from `./intrinsic.js` (`flexbox.ts:45`, `grid.ts:35`, `tables.ts:49`, `block-inline.ts:32`); all five axes preserved per caller (`flexbox.ts:53-62` skipPositioned/borderBox/rowFlex; `grid.ts:42-51` blockDisplays incl. `table`, skipPositioned:false, borderBox:false; `tables.ts:59-70` pieceText/childMargins/childDisplays/nestedTableWidth, spaceStyle 'single' breaks 'cap'; `block-inline.ts:2654` spaceStyle 'piece' breaks 'skip'); dead `minimum` gone (`grep "\.minimum" src/layout/grid.ts` empty); single `contentInlineSizes` at `intrinsic.ts:246` | one shared intrinsic-sizing module in layout, parameterized by display-skip/space-style/break policy; delete `minimum` | **fixed** (gen-2 fix task `qa02-unify-intrinsic-sizing`; verify:all exit 0 at landing, spot gates re-run green here) | 1 |
| QA-03 | high | machine-check | `check-charter.mjs` parses only the §11 matrix table; the **Deferred / Not in v1** section (charter.md:223) — the documented "no silent absence" contract — has zero machine enforcement | `scripts/check-charter.mjs:176-227` still parses only the §11 matrix; `docs/charter.md:223` "Deferred / Not in v1 (no silent absence)" section unenforced | give the Deferred section a table schema (Absent surface / Status / Evidence) and extend check-charter to assert token presence/absence per status | open (fix task `charter-deferred-enforcement` exists, gen 0, unlanded) | 0 |
| QA-04 | high | ledger | `docs/ledgers/coverage-matrix.md` contradicts charter §11: its deferred table claims box-shadow, opacity, calc/min/max/clamp, custom-properties/var() EMPTY/absent while §11 marks all of them implemented with corpus coverage and the corpus dirs exist and verify; also says "all 53 rows" while the matrix has ~103 | gen-2, drifted-further: `coverage-matrix.md:76-80` still lists opacity/shadow/calc/custom-props as EMPTY/never-landed while charter §11 marks them implemented=yes with corpus tokens (`charter.md:140-143,174-175,179,196-198`); `coverage-matrix.md:78` tables row still says collapse "is the follow-on" owned by `tables-border-collapse`, which LANDED gen 1; `coverage-matrix.md:112` "all 53 rows" vs 103 §11 data rows | regenerate the ledger's deferred table from the charter (after QA-03's schema), never hand-write it | open — drifted-further (tied to QA-03's schema; deferred pending `charter-deferred-enforcement`) | 0 |
| QA-05 | high | gates | Verify-gate coverage holes: **9 verify scripts are not in `verify:all`** (verify-colors, verify-custom-properties, verify-legacy-removal, verify-measure-perf, verify-measure-persist, verify-paint-fallback, verify-paint-perf, verify-property-coverage, verify-rtl); `verify-rtl.mjs` and `verify-paint-fallback.mjs` are wired into **no** npm script at all; `parity.md` still calls the 21-script subset "the full `npm run verify`" | `package.json:22` `verify:all` still omits all 9 (grep per script: NOT in verify:all); `verify-rtl`/`verify-paint-fallback` grep of package.json: zero npm entries; `docs/ledgers/parity.md:24` "full `npm run verify`" overclaim persists | wire all environment-independent scripts into `verify:all`, give the remaining two npm entries (or a documented tier), fix the parity.md wording | open (fix task `verify-gate-coverage` exists, gen 0, unlanded) | 0 |
| QA-06 | medium | code | sRGB linearization duplicated across the product/harness boundary **with coefficient drift**: `paint.ts` uses Blink-port coefficients (0.2126/0.7152/0.0722) vs `harness/deltaE.ts` sRGB spec coefficients (0.2126729/0.7151522/0.072175), same 0.04045/12.92/1.055/2.4 curve | **disproven — intentional (gen 1, unchanged):** `paint.ts:215-222` is a documented **WCAG relative luminance** (rounded 0.2126/0.7152/0.0722) for the inset/outset border heuristic; `deltaE.ts:38-53` is a full **CIE XYZ→Lab** matrix (0.4124564/0.3575761/0.1804375; 0.2126729/0.7151522/0.072175; 0.0193339/0.119192/0.9503041) for ΔE\*ab per charter. Different formulas, each correct for its use; the only shared piece is the byte-identical `srgbToLinear` curve — a hygiene nit, not a drift bug. No re-open evidence emerged at gen 2 | (disproven — no fix task) | **disproven** (gen-1 verification; evidence above; not re-opened) | 0 |
| QA-07 | med-high | scripts | The verify harness is hand-rolled ~35×: scripts define a `fixtures()` walker, 36 copies of `textRegionMask()`, ~40 near-verbatim Chrome-harvest blocks, ~42 identical report tails; `verify-tables.mjs` vs `verify-layout-flexbox.mjs` are 241-line files differing in 14 lines. `scripts/lib/` is nearly orphaned (2 modules, 6 importers) | gen-2: `scripts/lib/runner.mjs` (293 lines) is the single shared pipeline; `verify-tables.mjs`/`verify-tables-collapse.mjs`/`verify-layout-flexbox.mjs` are ~30-line `runVerify` imports; `grep 'function textRegionMask' scripts/verify-tables.mjs scripts/verify-tables-collapse.mjs` empty; copy counts across scripts/*.mjs strictly down (textRegionMask 36→33, fixtures walker 51→48); `scripts/lib/` = runner.mjs + expected.mjs + sweep.mjs | extract `scripts/lib/runner.mjs` (discover fixtures → harvest → mask → evaluate → report) with per-corpus hooks; migrate in batches (table family first), `verify:all` green after each batch | **registered** (gen-2 fix task `qa07-verify-runner` landed the runner + table family; gen-3 re-confirmed at HEAD: runner.mjs 286 lines, three migrated scripts ~28-line `runVerify` imports, copy counts 36→33 / 51→48; residual = remaining corpus families, per-batch roadmap below) | 1 |
| QA-08 | medium | ledger | `docs/ledgers/parity.md` stale: gap census says 2 declarations and lists `media-queries/container-gap`, but the corpus has **4 typed gap declarations across 2 fixtures** (`container-gap` flipped to pass; `legacy-removal/legacy-elements` declares 3 and is omitted); its Latest Run (2026-08-14/17) predates the 2026-09-03+ landings | gen-3, drifted-further: `parity.md:92-104` census lists `media-queries/container-gap` (gen-3 re-confirmed: its `fixture.json` `expected.computedStyle` is now `"pass"` — flipped, no typed gap) + `harness-tolerances/regression-divergence`, omitting `corpus/legacy-removal/legacy-elements/fixture.json` which declares 3 (`computedStyle`/`rect`/`screenshot`, all `fail` with reason+sunset); parity.md's "Current count: 2" vs check-charter's "4 typed gap declaration(s)"; Latest Run rows still 2026-08-14/17 (line 23-25) predating unicode-bidi/text-level-ua/tables/outline/sweep + tables-collapse + qa07/qa10; `parity.md:24` overclaim (shared with QA-05) | regenerate census + Latest Run from real runs (extend the sweep/layers refresh pass to this ledger) | open — drifted-further | 0 |
| QA-09 | medium | code | Cascade parse-helper duplication family: `supports.ts:27-43` `splitValue` is a byte-clone of **already-exported** `css.ts:1018` `splitTopLevel`; selector-list splitter ×2; aspect-ratio comparator ×2 with duplicated ratio parsing; media comparator ×2 with identical semantics; container-condition grammar is a parallel media-grammar with a hand-maintained `==` divergence (Blink-correct, but two tables) | **fixed at gen-3 HEAD (fix task `qa09-unify-cascade-parse-helpers` landed):** (a) one shared `splitTopLevel` (`css.ts:1018`, exported) serves supports.ts — clone deleted, `grep "function splitValue" src/cascade/supports.ts` empty; (b) one shared selector-list splitter `splitSelectorList` (`selector.ts:421`, exported) serves `stylesheet.ts` (local `splitSelectors` deleted) and `parseSelectorList` — `grep -c "function splitSelectorList" src/cascade/*.ts` = 1; (c) one aspect-ratio helper pair `parseRatio` + `compareAspectRatio` (`media.ts`) serves the @media and @container evaluators with the b===0 guard — `grep -c "function parseRatio" src/cascade/*.ts src/cascade/phases/*.ts` = 1; (d) one media comparator `compareNum` (`media.ts`, exported) serves `phases/media-queries.ts` (local `compare` deleted) — `grep -c "function compareNum\|function compare(" src/cascade/*.ts src/cascade/phases/*.ts` = 1. The container-condition grammar (parallel media-grammar with the hand-maintained Blink-correct `==` divergence) is untouched — deliberate, registered residual | one splitter, one scanner, one comparator each (done); parameterize the container dialect flag (residual) | **registered** (gen-3 fix task `qa09-unify-cascade-parse-helpers` landed — helpers consolidated + closure greps above; residual = container-condition dialect parameterization, explicitly out of scope this window — see attempt log) | 1 |
| QA-10 | medium | arch | Monoliths and hidden state: `block-inline.ts` is 3429 lines / 9 responsibilities; `makeStyle` spans ~990 lines running parse+assemble per property; the block-level display skip list appears 4× inside block-inline with term drift; border-box height normalization duplicated; module-level mutable layout globals | gen-3: display-skip consolidation **done** — one exported `isBlockLevel(display)` predicate at `block-inline.ts:860`; the four walker sites call it with their float/position variants preserved (`hasInlineContent` 886 + float; `hasBlockLevelChild` 905 + float + position; `collectInlineText` 957 neither; `buildPieces` 2799 + float + position; gen-2 numbering was 872/888/937/2777). Closure: `grep -n "s.display === 'block'" src/layout/block-inline.ts` empty; `grep -c 'function isBlockLevel' src/layout/*.ts` = 1. Residual persists: `block-inline.ts` 3424 lines / 9 responsibilities; module globals `paintScPath` 491, `cbStack` 495, `clipStack` 505, `opacityStack` 522; `makeStyle` still spans ~990 lines | extract behind existing exports: style-resolve / paint-op / inline-format / block-flow (isBlockLevel done); thread the stacks. `makeStyle` splits per property-group | **registered** (gen-3 fix task `qa10-unify-block-display-skip` landed the isBlockLevel slice; gen-3 re-confirmed at HEAD — predicate at `block-inline.ts:860`, sites 886/905/957/2799, enum grep empty, count=1; residual = extraction + stack threading + makeStyle split — see attempt log) | 1 |
| QA-11 | medium | config | `safari.ts:34` hardcodes `/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf`, violating the stated no-home-dir policy (`chrome.ts` `fontPath` pattern; vendored copy exists at `fonts/HackNerdFont-Regular.ttf`); `chrome.ts:131` lists `'Droid Sans Japanese'` in scriptCoverage with no registration/fallback reference (verify, then remove); safari config is wired but has no verification loop (unlike firefox) — probe-only per charter §4 until WebKit oracle lands | `src/config/safari.ts:34` hardcoded home-dir path persists; `src/config/chrome.ts:40` `fontPath(env, repoFile)` is the sanctioned pattern and `fonts/HackNerdFont-Regular.ttf` is vendored; `src/config/chrome.ts:131` `'Droid Sans Japanese'` row still unverified | route through `fontPath(env, repoFile)`; drop dead row after grep-disproof of references; ledger marks safari probe-only | open (fix task `safari-config-fix` exists, gen 0, unlanded) | 0 |
| QA-12 | medium | code | measure/canvas seam duplication: alignment/justify block copy-pasted 3× inside `measure.ts` + once at block-inline; indent-mode logic duplicated; `skia.ts` duplicates its `measure`/`hasFamily` closures internally; `pretext/index.ts` constructs a **new `Intl.Segmenter` per call** on the hot measure path while `script-fallback.ts` holds a singleton; two font-shorthand parsers at the same seam; dead export `fontMetricsKey` | `src/pretext/index.ts:135` per-call `new Intl.Segmenter` (vs `script-fallback.ts:122` singleton and `css.ts:2840-2841` module singletons); `skia.ts:57-60` vs `142-143` duplicated `measure`/`hasFamily` closures — re-confirmed at gen-3 HEAD (skia numbers 57-64 vs 143-147); `fontMetricsKey` at `fontmetrics.ts:88` has zero read sites | one alignment/justify helper, one indent-mode helper, skia closures to private methods, one shared segmenter + shorthand parser in `canvas/` | open (fix task `qa12-unify-measure-seam` created gen 3) | 0 |
| QA-13 | low-med | hygiene | Drift-prone edges: fallback tables hand-mirrored into 3 ledgers with no sync check and `chrome.ts` self-mapping rows appear in no ledger; config⇄canvas module cycle; barrel gaps; dead mode validation `tolerances.ts:81`; `media.ts:9-10` header claims `print` support but the evaluator drops `@media print`; ~17 zero-reader cascade exports + 5 unread pretext wrapper types + `SkiaCanvasFactory` class export unread | `tolerances.ts:81` still `x === 'exact' ? 'exact' : 'exact'`; `media.ts:10` still claims `print` while evaluator `media.ts:477` drops it (all/screen only); `canvas/index.ts` still omits `measure-cache`, `cascade/index.ts` still omits `supports` | generated-or-asserted ledger tables; registered invalidate callback breaks the config cycle; barrel completion; validation fix; dead-export sweep batch | open | 0 |
| QA-14 | low | scripts | Two font conventions across verify scripts: 44 read `FONT_FILE`/`FONT_FAMILY` env, 11 use `chromeConfig.defaultFamily/defaultFile`, 4 use neither — harvest setups are not interchangeable | gen-2: `scripts/lib/runner.mjs:24-25` now owns the single `FONT_FILE`/`FONT_FAMILY` convention (env override preserved) for the 3 migrated scripts; the remaining scripts still carry per-script constants, retired batch-by-batch on the QA-07 roadmap | fold into QA-07's runner (one convention, env override preserved) | **registered** (folded into QA-07; the runner centralizes the convention for migrated scripts, residual scripts migrate per the QA-07 roadmap) | 1 |
| QA-15 | low | code | `LATIN_SAFE_RE` (`script-fallback.ts:157`) deliberately matches ASCII control characters (`\x00-\x7F`, intent documented inline); the TS language server flags it (`no-control-regex`-class diagnostic). Build is green today, but a future lint gate would fail on it | `src/canvas/script-fallback.ts:157` unchanged (`/^[\x00-\x7F\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\s]+$/u`); gen-2 HEAD still has **no lint/typecheck npm script** (`package.json:20` `"build": "tsc -p tsconfig.json"` only) — nothing can flag it today | verify-first: if no lint gate exists, the inline justification is already present — either wire an eslint-disable with reason or narrow the class if controls are unreachable in text content; only matters once a lint gate lands | open (registered; conditional on a lint gate landing) | 0 |
| QA-16 | low | hygiene | No package lockfile committed: `pnpm install` resolves the `^` ranges to the newest available, so generated artifacts (candidate renders, timing ledgers) are not reproducible across environments | gen-3 (QA-09 landing): with the src changes stashed (pure HEAD tree), a fresh `pnpm install` (resolved `@napi-rs/canvas` 1.0.8 from `^1.0.5`, `typescript` 5.9.3 from `^5.5.3`, no committed lockfile — `git ls-files` shows none) still rewrote `corpus/custom-properties/inheritance/candidate.png` 2121→1199 bytes; verify:custom-properties PASS either way (within tolerance) | commit `pnpm-lock.yaml` (or exact-pin deps) so candidate/ledger artifacts are byte-reproducible across environments | open (registered gen 3) | 0 |

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
