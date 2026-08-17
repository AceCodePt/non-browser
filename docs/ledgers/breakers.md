# Breakers Ledger

Owning seam: `@chenglou/pretext` prepare/layout over the Canvas interface's
measureText (`src/pretext/index.ts`), with the `OffscreenCanvas` shim that
routes Pretext's measurement through the generic Canvas interface. The engine's
shipped text path is the Pretext breaker: `layoutTextLines` feeds the wrapping
modes (`normal`/`pre-line`/`pre-wrap`) through `breakNextLine`
(`src/layout/measure.ts`), and the pure-text block path delegates to it via
`layoutInlineContent` (`src/layout/block-inline.ts`). Floats, flexbox and grid
items reach the same code through their `layoutTextLines` call sites.

## Current behavior

- **Pretext breaker (default)** — the break/word-fill decision for every
  wrapping mode comes from `breakNextLine` over the Canvas interface. The
  Chrome-parity layers stay owned by `layoutTextLines`: float-intrusion (the
  `available(top, bottom)` callback), per-word stretched advances for
  `text-align: justify`, and the per-mode white-space handling
  (normal/nowrap/pre/pre-wrap/pre-line, incl. the pre-wrap hung-space union
  line box and the alignment-with-overflow rules). `layoutTextLines` keeps
  only those layers; it does not re-decide where a line breaks.
- **Greedy fallback (flagged)** — `wrapWords`/`fillWordLines` is the
  hand-rolled space-break wrapper, reached only when the breaker knob selects
  it (`CASCADE_BREAKER=greedy`, see `applyBreakerFromEnv`). Its engagement
  rule is explicit: the fallback never engages on its own — Pretext's
  `prepare` produces a break opportunity for every non-empty wrapping text
  (spaces, CJK graphemes, hyphens, long-word grapheme splits), so `breakNextLine`
  returns null only when the text is exhausted. The fallback exists solely as
  the operator opt-out from Pretext-specific divergences (below) and as the
  drift gate's reference.
- **Mixed inline content** — blocks whose inline content mixes text runs with
  inline-level boxes or foreign-style spans, and `justify` lines, are laid out
  by the inline-piece walker (`layoutInlineContent`/`walkLine`) — a text-run
  mechanism Pretext's plain-string model cannot express. Pure single-style
  text routes through the Pretext breaker; the walker stays for the mixed
  cases only.
- **Drift gate** — `npm run verify:breaker` renders the spine corpus twice
  (Pretext vs greedy) and asserts line counts and line widths agree, so the
  fallback cannot silently diverge from the shipped breaker.

## Method

- `npm run verify:breaker` (scripts/verify-breaker.mjs) — breaks every
  `corpus/breaker/` fixture with the engine (Pretext path) and diffs line
  counts and per-line break positions against Chrome's
  `Range.getClientRects()`, merged per line (Chrome surfaces zero-width
  newline boxes and per-word boxes on justified lines). Exit requires >= 95%
  line-count parity, every divergent fixture to declare `knownDivergence`
  (and still diverge), and every declared divergence to be documented here.
- `npm run verify:four-layer` — the engine's own line fragments (rendered
  through the Pretext breaker, asserted active) are compared with Chrome's
  per-line boxes within the layer-3 rect band; the layer-1 mean/max
  measureText band is enforced by the harness. There is no separate seam call
  under test — the engine path is the verified breaker.
- `verify:firefox` does the same against Gecko's fragments.

## Results

`npm run verify:breaker` (2026-08-17, node 26.7.0, Chrome 151): 21/22 corpus
fixtures at line-count parity (95.5%). All declared divergences (`long-word-default`)
still diverge and are entered below. Drift gate green: greedy and Pretext
agree on all 16 spine lines.

Four-layer/firefox/text-align/white-space run green with the engine breaking
text through Pretext; the previous red Pretext-seam mean overage (basic-text
0.0117px, wrapping 0.0123px) is gone because the seam call was removed — the
engine's own fragments (measured with the engine's canvas) are what the
layer-1 band gates.

## Divergences

Each entry has a concrete input and, where the divergence is patchable at the
Pretext-config level, the configuration that would close it. Pretext's
`prepare` options are `whiteSpace` ('normal'|'pre-wrap'), `wordBreak`
('normal'|'keep-all') and `letterSpacing`; there is no overflow-wrap option.

- **overflow-wrap:normal long words** (`corpus/breaker/long-word-default`) —
  Pretext's default line breaking always applies `overflow-wrap: break-word`
  semantics (its `prepare` pre-measures breakable grapheme runs), so a long
  word with no break opportunity is split at grapheme boundaries. Chrome's
  default `overflow-wrap: normal` never splits it — the word overflows the
  line. Input: `supercalifragilisticexpialidocious antidisestablishmentarianism
  pneumonoultramicroscopicsilicovolcanoconiosis` at 120px → Chrome 3 lines,
  engine 9. Patchable only when Pretext exposes an overflow-wrap:normal mode
  (or the engine parses overflow-wrap and requests break-word only when
  declared); until then it is the one line-count divergence in the corpus.
- **Long-word grapheme-boundary rounding**
  (`corpus/breaker/long-word-breakword-80`, `long-word-breakword-200`) —
  line counts match Chrome but the split point inside a long word can shift by
  one or two graphemes: Pretext's grapheme-prefix fit advances sum slightly
  differently from Chrome's per-glyph measurement, so the last grapheme that
  fits a line differs. Sample: at 80px the antidisestablishmentarianism split
  gives Chrome line widths 79.73/17.56 vs engine 73.12/27.23 for the same
  line pair. Not patchable via options; recorded as a known position delta.
- **CJK kinsoku placement** (`corpus/breaker/cjk-punctuation`) — line counts
  match Chrome, but the exact break position around fullwidth punctuation
  differs because Pretext's kinsoku (line-start/end prohibited punctuation)
  sets are hand-rolled while Chrome uses ICU. Sample: `《红楼梦》是中国古典
  四大名著之首，被誉为"中国封建社会的百科全书"。` at 180px → same 5 lines,
  break positions differ by up to 9.5px. Patchable via Pretext config only if
  a future option carries ICU's line-break tables.
- **Soft hyphens** (U+00AD, not in the corpus) — Pretext treats U+00AD as a
  break opportunity and renders the hyphen at the break; Chrome with
  `hyphens: none` neither breaks nor renders it. Documented for when a
  soft-hyphen fixture lands; patchable only via a Pretext option disabling
  discretionary hyphenation.
- **pre-wrap tabs** (not in the corpus) — Pretext advances tabs to tab stops
  (8 × space), while the inline-piece walker measures them as text. The block
  path keeps tab-bearing pre-wrap content on the walker (the delegation in
  `layoutInlineContent` excludes `\t`/`\r`/`\f` under pre-wrap) so behavior is
  unchanged; a tab fixture would record the Pretext tab-stop advance as the
  target.

## Remaining hand-rolled paths (by design)

The inline-piece walker still owns word-fill for mixed inline content (atomics,
foreign-style spans) and `justify` lines — those need per-run styling Pretext's
plain-string model cannot carry, and the pre-wrap/pre-line/pre/nowrap white-space
handling in `layoutTextLines` is the layering layer the breaker swap preserves.
The drift gate and the spine four-layer both prove the shipped path is the
Pretext breaker for the pure-text cases this ledger covers.
