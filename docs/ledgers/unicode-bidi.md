# unicode-bidi property and the bdo element

Owning module: `src/layout/css.ts` (the computed `unicodeBidi` value),
`src/cascade/ua.ts` (the WHATWG bidi-rendering UA rules), and
`src/layout/computed-style.ts` (CSSOM serialization). Corpus
`corpus/unicode-bidi/`, verified by `scripts/verify-unicode-bidi.mjs`
(`npm run verify:unicode-bidi`).

## Scope

The engine resolves direction at the box level (`direction`, the `dir`
presentational hint, logical margins/insets/float/text-align). This slice adds
the computed `unicode-bidi` surface and the bdo element on top of that:

- **Computed value set** (css-writing-modes-4 §3.1): `normal`, `isolate`,
  `bidi-override`, `isolate-override`, `plaintext`. The legacy `embed` keyword
  (deprecated in §3.1) is deliberately absent and drops to `normal` like any
  unparseable declaration.
- **UA defaults** (the WHATWG HTML rendering spec's bidi block, mirrored from
  Blink html.css): every block container and `[dir]` element computes
  `unicode-bidi: isolate`; `bdo`/`bdo[dir]` computes `isolate-override`;
  `textarea[dir=auto]`/`pre[dir=auto]` compute `plaintext`. The engine had no
  bdo handling before — bdo was already an inline tag, and its `dir` attribute
  already fed `direction`, but the computed `unicode-bidi` did not exist.
- **bdo direction override**: bdo's content renders in the element's direction.
  Because direction is resolved at the box level, a bdo's `dir` (ltr or rtl)
  already forces its content and line alignment (`text-align: start/end`
  resolves per that direction) exactly where Chrome puts the boxes; the
  fixture's block-level bdo with `text-align: start` under `dir: rtl` has its
  line box at the inline-start (right) edge, matching Chrome's
  `Range.getClientRects()`.

## The reordering boundary (declared, not claimed)

The engine does **not** run the Unicode BiDi Algorithm. In particular:

- Within a single-direction line the engine mirrors runs from the inline-start
  edge per the box direction (which is what makes rtl blocks, bdo boxes, and
  `bidi-override` line *boxes* match Chrome), but it does not reorder
  mixed-direction runs inside a line. An LTR bdo inside an RTL paragraph (or
  any Latin-in-RTL / Hebrew-in-LTR override) lays its glyphs in logical order
  rather than the reversed visual order Chrome produces. The mirrored glyphs
  therefore fall under the documented text tier of the screenshot comparison —
  the corpus masks them (textElements / maskContentBoxes) and compares the
  boxes, backgrounds and computed values strictly.
- The corpus deliberately exercises each bdo in a matching-direction context
  (dir=rtl in an LTR paragraph, dir=ltr in an LTR paragraph, block-level
  dir=rtl) so the compared quantities stay within the four-layer tolerances;
  mixed-direction paragraph reordering is a separate feature and is not
  silently claimed.

Full UBA reordering (UAX #9) within inline runs is a large separate feature;
this slice is the computed surface + bdo element so that direction override and
inline alignment behave correctly at the box level.

## The `direction: ltr` fall-through fix

While authoring the fixtures an existing latent bug surfaced: `makeStyle`
computed `direction` as `rtl` only when the winning declaration said `rtl`, and
otherwise fell through to the *inherited* direction. So an explicit
`direction: ltr` (or `dir="ltr"`) could never override an inherited `rtl`.
Existing fixtures never hit it because every `direction: ltr` in the corpus
lives in an LTR context, where the fall-through happened to produce `ltr`. The
`bdo dir="ltr"` case exposed it; the fix makes an explicit `ltr` declaration
compute `ltr` (css-writing-modes-4 §2.2) without touching any other path.
`corpus/rtl-layout` stays green.

## Corpus (3 fixtures)

| Fixture | Covers |
| --- | --- |
| `bdo-dir` | bdo UA `isolate-override` computed + `dir` feeding direction (rtl and ltr inline in an LTR paragraph), block-level bdo `dir: rtl` resolving `text-align: start` to the right edge with its line box there |
| `override` | author `unicode-bidi: bidi-override` — block-level dir ltr/rtl × `text-align` start/end (the four line-box placements), plus an inline `bidi-override` span with `dir: rtl` |
| `isolate` | `isolate`, `isolate-override`, `plaintext` computed + serialized; isolate span boxes match plain spans; rtl isolate block right-aligned |

All fixtures pass all four layers: computed styles exact (unicode-bidi,
direction, text-align), rects ≤ 0.5px, text fragments (line boxes) ≤ 0.5px,
screenshots with **0.000%** non-text pixels exceeding (the mirrored override
glyphs land in the text tier).

## Results

`npm run verify:unicode-bidi` exits 0 (3/3 fixtures, all layers). The full
`npm run verify` stays green; `corpus/rtl-layout` is unchanged (worst rect Δ
0.006px) after the direction fix.

## Divergences (declared)

- **No UBA reordering of mixed-direction runs** — glyph order within an
  override run is logical, not the reversed visual order Chrome paints. Boxes,
  line boxes, backgrounds and computed values match; the glyph pixels fall
  under the text tier (see "The reordering boundary" above).
- **Legacy `embed`** (and other non-current forms) is not computed — the engine
  follows the css-writing-modes-4 §3.1 value set by design and drops `embed` to
  `normal`, matching the modern-compat program (README "Compatibility policy").

## Out of scope (by design)

Mixed-direction paragraph reordering (UAX #9) is not implemented; the corpus
does not exercise Latin-in-RTL / Hebrew-in-LTR override lines for pixel or
fragment parity, only for box/computed parity.