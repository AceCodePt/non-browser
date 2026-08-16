# White-Space Ledger

How the engine processes `white-space` in line breaking and measurement, and
the parity results against Chrome. Owning seam: `src/layout/measure.ts`
(`layoutTextLines`), `src/layout/block-inline.ts` (`layoutInlineContent`),
`src/layout/css.ts` (computed value + inheritance), and
`scripts/verify-white-space.mjs` (corpus `corpus/white-space/`).

## Model

The breaker honors the element's computed `white-space` value instead of
always collapsing. Each value is matched empirically to Chrome's line boxes:

| Value | Spaces | Newlines | Wrapping |
| --- | --- | --- | --- |
| `normal` | collapse runs + leading/trailing | collapse (→ space) | wrap at spaces |
| `nowrap` | collapse as normal | collapse (→ space) | **no wrap** (one line, overflows) |
| `pre` | preserve (incl. leading/trailing) | **forced breaks** | no wrap |
| `pre-wrap` | preserve | **forced breaks** | wrap at spaces |
| `pre-line` | collapse as normal | **forced breaks** | wrap at spaces |

Newline-preserving modes split the text on `\n`; a trailing newline's empty
final segment generates no line box (Chrome drops it), while empty interior
segments produce full-height empty line boxes (Chrome's zero-width boxes).

Two empirical Chrome behaviors were probed and matched (see
`probes/probe-white-space.mjs`):

- **pre-wrap hung space**: when a line wraps at a preserved space run, Chrome
  keeps a single space on the line (a `3.64px` box with no ink) and drops the
  rest of the run. The engine folds that one space into the line's width and
  text (spaces carry no ink, so painting is identical).
- **empty/trailing segments**: `"\n\ncontent\n\n"` lays out four line boxes —
  two leading empties, the content, one trailing empty — and the final empty
  segment after the last newline is dropped.

Chrome reports one `Range.getClientRects()` box per inline text box, so a line
can surface as several fragments (zero-width newline boxes, a hung space, a
preserved leading-space run, one box per inline element). The verifier merges
each side's fragments per line (same y) into a `[x, width]` union before
comparing, so the per-line geometry is the honest quantity both engines must
agree on.

## Gaps

None. `pre-wrap` and `pre-line` are implemented and verified (they were
eligible to be documented as gaps; they pass instead). Known limits kept out
of scope, all absent from the corpus:

- Tabs in preserved white space (`tab-size` advance to tab stops) are treated
  as a single space run; fixtures use spaces only.
- `text-align: justify` stretches inter-word spaces only for `normal` /
  `pre-line`; `pre-wrap` justify (stretching preserved runs) is not applied.
- A `white-space` override on a nested inline element (e.g. a `pre` span
  inside a `normal` paragraph) is not honored for space collapsing — the
  block's value drives the whole inline flow. `white-space` itself inherits
  correctly at the computed-value level.

## Result

`npm run verify:white-space` — 8 fixtures, all four layers PASS, line-box
geometry max Δ ≤ 0.026px (threshold 0.5px):

- `pre-basic` — newlines + preserved runs + indentation (3 lines)
- `nowrap-label` — overflowing single-line label (element stays 22px)
- `pre-fixed-box` — trailing spaces before a newline stay in the line box
- `pre-blank-lines` — leading/interior blank lines are empty line boxes, the
  trailing newline's final empty segment is dropped
- `nowrap-mixed` — text + inline span, one overflowing line
- `pre-wrap` — wraps at spaces, hung space + preserved indent matched
- `pre-line` — newlines kept, runs collapsed, indentation removed
- `computed-values` — computed `white-space` exact for all five values + inheritance

All other verifiers (`npm run verify` and every `verify:*`) remain green after
the breaker change.
