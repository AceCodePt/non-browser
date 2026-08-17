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
| R1 | flex/grid inline-detection `display:flex` skip-list drift | Confirmed (final) | **Fixed** — grid now skips `display:flex` children like flexbox |
| R2 | Duplicate media comparator (`compareNum`/`compare`) | Confirmed | **Acknowledged** (single-authority candidate) |
| R3 | Dead code (`void padBorderH`, `s==='0'`, `minimum` field) | Confirmed | **Fixed** (2 of 3); `minimum` Acknowledged |
| R4 | Monoliths (`block-inline.ts`, `makeStyle`) | Confirmed | **Acknowledged** |
| R5 | Two line-fills in `measure.ts` | Confirmed, designed | **Disputed in part** — seam-vs-fallback is intentional, drift-gated |
| R6 | Cascade⇄layout runtime import cycle | Confirmed | **Acknowledged** |

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

## Response to the code-focused rewrite (2026-08-17, same day)

The review was rewritten per the owner's request to stick to the code. The
document-level findings of the original (charter/README contradiction,
`verify:all` coverage, tokens, debris) are addressed in the sections above and
remain fixed. This section answers the rewrite's own findings and its
"Corrected" table.

### On the "Corrected" table

The table reads the earlier claims as *false*; they were **true when written and
fixed since**. The code moved under the original review:

| "Corrected" claim | Original state when written | Why it changed |
| --- | --- | --- |
| `Box` defined in `layout/types.ts`, no harness imports | TRUE then — `Box` was imported from `../harness/fixtures` by `render.ts`/`paint.ts`/`block-inline.ts` | Fixed in `328b45c` (moved to `types.ts`) |
| `breakNextLine`/`prepareText` unused | TRUE then — imported at `measure.ts:16`, zero call sites | Fixed when `pretext-breaker-path` attempt 3 wired `layoutTextLines` through it (`pretextWordFill`) |
| `usePretextBreaker` knob written never read | TRUE then — setters only | Fixed by the same breaker task (verified from `verify-four-layer.mjs`/`verify-breaker.mjs`/`bench`) |
| Two parallel text engines "kept by hand" | TRUE then — the inline walker's delegation existed, but the greedy wrapper was the shipped path for pure text | Resolved by the breaker task: pure text now routes through Pretext; the walker owns mixed content only |

The corrected table is accurate about the *current* tree; it should not be read
as a retraction of the original findings, which drove the fixes.

### New confirmed problems

- **#1 flex/grid inline-detection drift — CONFIRMED (as revised), FIXED.** The
  reviewer's first-draft claim (grid omitted `letter-spacing` in `contentInlineSizes`)
  was retracted in the final review after reading both call sites — and that
  retraction is current-state accurate: after my earlier pass, `flexbox.ts:142/144`
  and `grid.ts:98/100` both pass `style.letterSpacing`. The genuine, final
  divergence is the `hasInlineText`/`collectInlineText` skip-list: flexbox skips a
  child whose `display` is `block|grid|flex`; grid skipped only `block|grid`, so a
  `display:flex` child's text was counted as inline content under a grid but not
  under a flex container. Fixed: `grid.ts` now skips `display:flex` children too,
  matching flexbox. Latent (no corpus fixture nests a flex child with inline text
  inside a grid, so the oracle never saw it). `verify:layout-grid`,
  `verify:layout-flexbox`, `verify:sweep` PASS after the fix. The deeper factoring
  of the now-identical helpers into one shared function is **Acknowledged** as
  scheduled debt (three `collectInlineText` variants exist; block-inline's carries
  `::before`/`::after` and `list-item`, so they do not trivially merge).
- **#2 duplicate media comparator — CONFIRMED.** `compareNum` (`cascade/media.ts:223`)
  and `compare` (`cascade/phases/media-queries.ts:111`) are the same seven-case
  switch. **Acknowledged** — candidate for one comparator under
  `coherence-generalize`'s single-authority mandate.
- **#3 dead code — CONFIRMED, two of three FIXED.** `void padBorderH`
  (`block-inline.ts`) and the unreachable `s === '0'` branch (`css.ts`) are
  removed. `inlineContributions`' `minimum` return field has zero readers —
  **Acknowledged** (removing it is safe but touches grid's public call shape;
  scheduled with the #1 factoring).
- **#4 monoliths — CONFIRMED, Acknowledged.** `block-inline.ts` (~2.4k lines,
  five responsibilities) and `makeStyle` (~660 lines) are the concentrated-risk
  debt; not scheduled beyond `coherence-generalize`.
- **#5 two line-fills in `measure.ts` — PARTIALLY DISPUTED.** `pretextWordFill`
  and `fillWordLines` are indeed two fill loops, but they are the **designed**
  seam-vs-fallback split: Pretext is the shipped breaker (default), the greedy
  wrapper is the `CASCADE_BREAKER=greedy` opt-out, and `verify:breaker`'s drift
  gate proves they agree on the spine. The duplication is the fallback's purpose,
  not an accident. What the reviewer is right about: a knob selecting between two
  full implementations is inherent risk, which is why the drift gate exists.
- **#6 cascade⇄layout runtime import cycle — CONFIRMED, Acknowledged.** Verified:
  `block-inline.ts` value-imports `resolveUaDecls`; `cascade/stylesheet.ts`
  value-imports `parseDeclarationBlock`. The named pipeline is not reflected in
  the import graph. ESM tolerates it; the fix (moving `parseDeclarationBlock` /
  `resolveUaDecls` across the boundary) is a real refactor, not scheduled.

### Bottom line on the rewrite

The rewrite is the better review: code-grounded, and its headline finding — the
flex/grid inline-detection skip-list divergence — is a real latent bug the oracle
hadn't caught, now fixed (grid matches flexbox on `display:flex` children). Its
structural thesis ("duplication, not cleverness") is accepted; the concrete dead
code is cleared, and the remaining duplication (media comparator, grid minimum
field, the two fill loops' shared risk, the import cycle) is acknowledged with
owners or scheduled with `coherence-generalize`.

## Honest residuals (updated after the rewrite)

1. `verify:all` green; residual typed gaps are `@container` sizing and the
   deliberate regression self-test.
2. Cascade⇄layout import cycle; `makeStyle`/`block-inline.ts` monoliths;
   flexbox/grid sizing not yet factored into one helper; `minimum` field unread;
   duplicated media comparator.
3. `check-charter` still does not parse the Deferred list.
4. No pre-commit rule yet forbids root scratch files.
5. The text-pixel tier (75–79% of glyph pixels over ΔE2) remains the structural
   ceiling on layer-4 text claims.
