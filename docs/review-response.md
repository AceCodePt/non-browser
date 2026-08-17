# Response to the Honest Assessment — cascade-core (2026-08-17)

Responds to `docs/review-honest-assessment.md` (2026-08-17). Every finding was
re-verified against the tree at response time (file:line + commit refs).
Disposition terms: **Fixed** (change landed), **Owned** (an active task or
ledger item is responsible), **Acknowledged** (accepted as debt/limitation,
not scheduled), **Disputed** (finding partly rejected).

## Disposition summary

| # | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| 1 | Charter/README contradict the corpus | Confirmed | **Fixed** (both halves) |
| 2 | Default `npm run verify` covers 44% of fixtures | Confirmed | **Fixed** (`verify:all`); the full gate is green again after `pretext-breaker-path` retired the standalone seam call |
| 3 | Text pixels effectively un-gated (97% tier) | Confirmed, already disclosed | **Acknowledged** — documented structural rasterizer gap; no tolerance change |
| 4 | Coverage-matrix enforcement is substring grep | Confirmed | **Fixed** (paren-precise tokens) |
| 5 | 26 scratch files committed at root | Confirmed | **Fixed** (deleted + no-op guard); residual hygiene rule not yet in place |
| 6 | Code-quality debt (layering, cycle, dead code, size) | Confirmed | Box layering **Fixed**; breaker scaffolding and the two-text-engines **Fixed** (Pretext shipped breaker, attempt 3); the rest **Acknowledged** |

## Per-finding detail

### 1. The charter contradicts itself, and the machine-check can't catch it — FIXED

The review was correct on both clauses, and the second one caught a staleness the
project had introduced mid-flight:

- The §11 matrix claimed calc/box-shadow/text-shadow `implemented: yes` while the
  Deferred list still said "not implemented." Fixed by removing the two stale
  bullets (the features shipped; `corpus/calc`, `corpus/box-shadow`,
  `corpus/opacity` all verify).
- `README.md` (written before those tasks landed) listed "`calc()`, opacity
  compositing, … not in v1." Fixed in `328b45c` to name only what is actually
  absent: `direction: rtl` (active task), tables and image decoding (charter §3
  out-of-scope).

The residual truth in the review's framing — the machine-check does not parse the
Deferred list, so the two halves can still drift — is **Acknowledged**: keeping
them consistent is a manual ledger discipline until `check-charter` grows a
Deferred-section parse. The README staleness clause is also **Fixed**: `direction:
rtl` was listed as an active task and is now implemented + corpus-verified
(`corpus/rtl-layout`, `verify:rtl`); only tables and image decoding remain out of
v1.

### 2. `npm run verify` covers 127/288 fixtures (44%) — FIXED

Confirmed: the default gate ran only spine + sweeps + cross-family + ua-styles.
Remedied with a full gate:

- `npm run verify:all` chains all 28 verify scripts + `check-charter`
  (`package.json`, `328b45c`).
- The session-idle fallback case (unmapped tasks) now runs `npm run verify:all`,
  so the daemon's default acceptance covers every marquee claim.
- `npm run verify` remains the fast subset (documented as such); the README's
  "all numbers reproducible via `npm run verify`" claim was reworded to point at
  `verify:<feature>` scripts and `verify:all`.

The earlier red state is **resolved**: the seam-mean overage (`basic-text`
0.0117px, `wrapping` 0.0123px) belonged to the standalone Pretext-seam call;
`pretext-breaker-path` (third attempt) retired that call so the engine path —
which breaks through Pretext — is the path under test, and `verify:four-layer`
passes (engine-breaker max Δ ≤ 0.015px). The full gate is green again.

### 3. Text pixels are effectively un-gated — CONFIRMED, DISPUTED as "hidden"

The numbers are right (75–79% of glyph pixels exceed ΔE2 under the 97% tier),
but the finding overstates the disclosure gap:

- `docs/ledgers/parity.md` Honest Reading #1 and `tolerances.json` document the
  tier and why (the two Skia rasterizers hint glyphs differently; Chrome's own
  canvas is 73% divergent from its own DOM text).
- `README.md` "What these numbers do NOT prove" states it verbatim, and the
  at-a-glance screenshot row is explicitly scoped to **non-text** pixels.

The tier is a disclosed structural rasterizer gap that neither Skia instance can
close; reducing it is long-term research, not a doc or tolerance fix. No
tolerance change was made.

### 4. Coverage-matrix enforcement is substring grep — FIXED

Confirmed: `check-charter.mjs` used `String.includes(token)`, so the `min` token
was satisfied by any `min-width`. Note that word-boundary regex does not
distinguish `min(` from `min-width`, so the fix is **precise tokens**: the value
function rows now use `calc(`, `min(`, `max(`, `clamp(` (min/max split into two
rows so each is independently claimed). `check-charter` PASS. The mechanism is
still substring search — the schema's single-token-per-row model limits how
precise it can get.

### 5. Repo hygiene: 26 scratch files at root — FIXED

Confirmed, including that the daemon's own `git add -A` commit block was the
vector. All 24 `probe-*`/`tmp-probe-rtl*` files are deleted. The empty-archive
root cause is closed with a **no-op guard**: `session-idle` now refuses to pass a
task whose branch carries no changes at all (`.orchestration/hooks/session-idle`,
`94e3e04`). Residual: a task that *produces* scratch files can still commit them
— a pre-commit hygiene rule (forbid root `probe-*.mjs`/`tmp-*.mjs`) is
**Acknowledged** as not yet implemented.

### 6. Code-quality debt — CONFIRMED; the layering inversion is FIXED

- **Layering inverted (renderer imports the harness)** — the most damaging
  finding, verified: `render.ts:32`, `paint.ts:19`, `block-inline.ts:25` imported
  `type Box` from `../harness/fixtures.js`. **Fixed in `328b45c`**: `Box` moved to
  `src/layout/types.ts`, the harness re-exports it, and no `src/layout/*` file
  imports from `src/harness/` any more (build green). This restores the charter's
  product/Playwright boundary at the type level.
- **Cascade⇄layout import cycle** (`cascade/stylesheet.ts` ↔ `block-inline.ts`)
  — verified, **Acknowledged** (ESM tolerates it; the type imports are one-way
  once `parseDeclarationBlock` moves, but that's a refactor, not scheduled).
- **Dead code** — verified: `void padBorderH` (`block-inline.ts:991`),
  unreachable `s === '0'` (`css.ts:526`). The `breakNextLine`/`prepareText`/
  `usePretextBreaker` scaffolding (`measure.ts`) that was imported/written but
  never read is **Fixed**: `pretext-breaker-path` (attempt 3) wired
  `layoutTextLines` through `breakNextLine` and the knob now has real call sites.
  The two dead lines remain **Acknowledged**.
- **Two parallel text-layout engines** (`measure.ts` greedy wrapper vs
  `block-inline.ts` inline walker, with a by-hand parity comment) — **Fixed**:
  the shipped path breaks through Pretext (`breakNextLine`); the greedy wrapper
  survives only as the `CASCADE_BREAKER=greedy` fallback, proven equivalent by
  the `verify:breaker` drift gate; the inline-piece walker stays only for mixed
  inline content and `justify` lines, which Pretext's plain-string model cannot
  carry (see `docs/ledgers/breakers.md`).
- **flexbox/grid duplicated helpers** (e.g. identical `hasInlineText`),
  `makeStyle` at 617 lines, `block-inline.ts` at 2317 lines — verified,
  **Acknowledged** as debt; the single-authority mandate of `coherence-generalize`
  covers the formula/constant duplication but has not consolidated these.

## What changed as a result of this review

- `94e3e04` — seam-mean gate enforced (`verify-four-layer.mjs`), no-op guard in
  `session-idle`, breaker/rtl REDOs restored, debris deleted, charter reconciled.
- `328b45c` — `Box` out of the harness; `verify:all` full gate + default fallback;
  paren-precise calc tokens; honest README.
- All three re-opened/gated tasks then **landed for real** (attempts 1–2 of the
  breaker and the first rtl dispatch had been empty archives; the no-op guard +
  task-specific gates made the third pass genuine): `pretext-breaker-path`
  (`d91a8fb`, corpus/breaker + `verify-breaker.mjs` + drift gate + perf guard),
  `rtl-direction-layout` (`5a8414a`, corpus/rtl-layout + `verify-rtl.mjs`),
  `overflow-clip-verification` (corpus/overflow + `verify-overflow.mjs`).
- `07b1ff9` — the honest-assessment review + this response, committed as a pair.

## Honest residuals (unchanged by this pass)

1. `verify:all` green again; the residual red candidates are the same typed
   gaps (`@container` sizing, the deliberate regression self-test) — not the
   seam, which is resolved.
2. Cascade⇄layout import cycle; `makeStyle`/`block-inline.ts` size; flexbox/grid
   duplication; two dead lines (`void padBorderH`, unreachable `s === '0'`).
3. `check-charter` still does not parse the Deferred list (the two charter halves
   can still drift by hand).
4. No pre-commit rule yet forbids the daemon from committing root scratch files.
5. The text-pixel tier (75–79% of glyph pixels over ΔE2) remains the structural
   ceiling on layer-4 text claims.
