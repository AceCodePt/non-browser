# Honest Assessment — cascade-core (2026-08-17)

Reviewer's note: every finding below was confirmed directly in the repo (file:line
references included). Nothing here is speculation. Severity-ordered.

## What is genuinely good (confirmed)

- **Verification is real, not a tautology.** Every engine-parity script harvests
  Chrome oracle values fresh via Playwright on every run and diffs the engine
  against them. The one self-comparison path (`scripts/harvest-oracle.mjs:68`
  writes Chrome values to both `reference`/`candidate`) is a disclosed harness
  self-test that even injects a deliberate divergence to prove the diff
  machinery fires.
- **Layers 1–3 are strict.** Spine rect Δ 0.0000px, measure mean ~0.0025px,
  computedStyle exact. The numbers look believable.
- **The ledgers are unusually candid** — `docs/ledgers/parity.md` has a real
  "Honest Reading" section; a failed run is preserved in `docs/reports/`.

## Problems, severity-ordered

### 1. The charter contradicts itself, and the machine-check can't catch it

`docs/charter.md` §11 coverage matrix says calc/min/max/clamp and
box-shadow/text-shadow are `implemented: yes, tested` (lines 135–137, 159–160) —
but the same charter's Deferred section says "**box-shadow / text-shadow — not
implemented**" (lines 180–181). `README.md:163` lists calc/opacity as "not in
v1" while `src/layout/calc.ts` (383 lines) and `corpus/opacity/` exist and
verify.

`scripts/check-charter.mjs` only parses the matrix table, not the Deferred list,
so the project's core promise — "no silent absence, nothing can drift" — is
exactly what's broken here. This is the most damaging finding: the docs are the
product's credibility engine.

### 2. `npm run verify` covers 127 of 288 fixtures (44%)

The default gate runs only spine (5) + sweeps (110) + cross-family (6) +
ua-styles (6). Every marquee claim — calc, opacity, box-shadow, border-radius,
text-measure 96/96, text-align, white-space, lists, pseudo-elements — rests on
separate `verify:<feature>` scripts **not in the gate**. `README.md:16` ("all
numbers reproducible via `npm run verify`") overstates it.

### 3. Text pixels are effectively un-gated

`tolerances.json` sets the text-region tolerance to `exceedPct: 97`; a spine run
passes with 75–79% of glyph pixels over ΔE 2. "Pixel-parity with Chrome" is true
only for non-text pixels. The ledgers disclose this honestly; the headline does
not.

### 4. Coverage-matrix enforcement is substring grep

`scripts/check-charter.mjs:160` is `String.includes(token)` — the min()/max()
row uses token `min`, which any `min-width` satisfies. A row can read
"implemented" while nothing meaningful is exercised.

### 5. Repo hygiene: 26 scratch files committed to root

`probe-*.mjs` / `tmp-probe*.mjs` / `tmp-probe-rtl*.mjs` — including
`probe-tmp.mjs` — were committed to the repo root by the daemon itself
(`orch: session-idle verification passed` commits). That is the daemon
committing its own scratch notes.

### 6. Code-quality debt in `src/`

- `src/layout/block-inline.ts` is 2317 lines across ≥5 responsibilities;
  `src/layout/css.ts` `makeStyle` is a 617-line function (1148–1765).
- **Two parallel text-layout engines** coexist (`src/layout/measure.ts` vs
  `block-inline.ts:2007`), and the file itself admits it must keep them
  parity-by-hand (`block-inline.ts:1603–1607`).
- flexbox/grid are near-verbatim copies of sizing helpers
  (`flexbox.ts:106–239` vs `grid.ts:62–189`); grid's `inlineContributions`
  returns a `minimum` field no caller reads.
- **Layering is inverted**: `render.ts:32`, `paint.ts:19`, `block-inline.ts:25`
  import the core geometry type `Box` from `../harness/fixtures` — the renderer
  depends on the test harness. Plus a cascade⇄layout import cycle
  (`cascade/stylesheet.ts:16` ↔ `block-inline.ts:26–27`).
- Dead code: unused `breakNextLine`/`prepareText` import (`measure.ts:16`),
  `usePretextBreaker` knob written but never read (`measure.ts:39–57`),
  `void padBorderH` (`block-inline.ts:991`), unreachable `s === '0'` branch
  (`css.ts:526`).

## Bottom line

The engine is serious, real work — the oracle-comparison discipline is genuinely
harder than the layout code. What will sink it is the credibility machinery:
the charter/README contradict the corpus, the "machine-checked" gate covers 44%
of the corpus with grep-strength enforcement, and the daemon commits its own
scratch files into the repo. For a project whose pitch is "trust these numbers,"
stale docs that claim to be drift-proof are the highest-risk item.
