# UA Defaults for Modern Text-Level and Sectioning Elements

Owning module: `src/cascade/ua.ts` (the UA rules), with the layout that makes
them render in `src/layout/block-inline.ts` and `src/layout/paint.ts` (per-run
inline backgrounds + text decorations) and `src/layout/css.ts` (relative
font-size keywords, `sub`/`super` vertical-align, disclosure list-style types).
Corpus `corpus/text-level-ua/`, verified by `scripts/verify-text-level-ua.mjs`
(`npm run verify:text-level-ua`).

## Scope

Chrome's html.css UA rules for the modern text-level/sectioning elements,
mirrored for the subset the engine renders:

- `mark` — yellow background (`rgb(255,255,0)`, the `Mark` system color) with
  black text (`MarkText`);
- `del`/`s` — `text-decoration: line-through`; `ins` — `text-decoration:
  underline`;
- `small` — `font-size: smaller`; `sub`/`sup` — `vertical-align: sub`/`super`
  plus `font-size: smaller`;
- `fieldset` — 2px `groove` border in `rgb(239,239,239)` (Blink's `ThreeDFace`
  system color on this headless-Linux Chrome), 2px inline margins, `0.35em
  0.625em` block / `0.75em` inline padding; `legend` — block with 2px inline
  padding;
- `details` — block container; `details > summary:first-of-type` — a
  `list-item` with `list-style: disclosure-closed inside` (and
  `disclosure-open` under `details[open]`).

`abbr` (without `title`) and `q` are plain inline elements (already in the
engine's inline tag map); `abbr[title]`'s dotted underline is outside scope
(the corpus only exercises bare `abbr`).

## How the layout makes these render

- **sub/sup baseline shift**: Blink shifts a `vertical-align: sub`/`super` box
  by the PARENT box's font size — `font_size/5 + 1` down, `-(font_size/3 + 1)`
  up, with LayoutUnit's truncating integer division
  (`InlineBoxState::ComputeVerticalAlignShift`, inline_box_state.cc). A 16px
  parent therefore shifts +4.1875px / −6.328125px, which is exactly where
  Chrome puts `<sub>`/`<sup>` rects. The engine threads an accumulated
  `baselineShift` through `buildPieces`, applies it to each run's line-box
  ascent/descent contributions and its own baseline/y, and the inline span
  rects use the shifted baseline. The shift of a nested box uses its own
  parent box's font size (a `<sup>` inside `<small>` shifts by small's
  13.3333px).
- **`smaller`/`larger`**: Chrome's relative font-size keywords are 5/6 and 6/5
  of the parent, rounded to four decimals (16px → 13.3333px), matching the
  engine's em rounding.
- **Per-run backgrounds and decorations**: an inline element's background-color
  (mark) paints over each run's content box (baseline ± rounded font metrics)
  behind its glyphs; a run's own `text-decoration` (del/s strike, ins underline,
  and the UA `a` underline, which now actually paints) is carried on the run and
  painted by the existing Blink-decoration geometry. Both force the content off
  the flat `layoutTextLines` shortcut (pure-text delegation rejects foreign
  runs with a background or decoration).
- **fieldset/legend**: the rendered legend (first in-flow `<legend>`) is pulled
  out of the content flow, measured, and placed over the block-start border —
  flush with the border-box top when taller than the border, centered within
  the border otherwise — with the remaining children flowing below the legend's
  protrusion past the border (the fieldset height grows by that protrusion).
  The legend shrinks to fit (Blink lays every legend in a fieldset as a
  shrink-to-fit BFC). The border is PAINTED centered on the legend box
  (`NGFieldsetLayoutAlgorithm::LayoutLegend`), so with a tall legend the top
  edge (and the side edges' top ends) shift down while the fieldset's geometry
  and content stay put.
- **details/summary**: `details` is a block; the first-of-type summary computes
  `display: list-item` with the disclosure marker as an inside list-style. The
  engine computes the marker's inline advance (Blink's 0.66em symbol box + 0.4em
  trailing margin) so summary text lands where Chrome's sits, but renders no
  marker box (see Divergences).

## Corpus (3 fixtures)

| Fixture | Covers |
| --- | --- |
| `text-level-inline` | mark fill + color, del/s line-through, ins underline, small 13.3333px, sub/sup 13.3333px + shifted baselines, bare abbr inline; q's computed styles match but its rect is not compared (the quote divergence) |
| `fieldset-legend` | fieldset groove border/margins/padding, legend shrink-to-fit straddling the top border, content pushed down by the legend protrusion, border painted centered on the legend |
| `details-summary` | details block container, closed + open summary list-item with `disclosure-closed`/`disclosure-open` computed, marker advance shifting the summary text |

All fixtures pass all four layers: computed styles exact, rects ≤ 0.5px,
measureText sub-pixel, screenshots within the §2/§10 bands (mark fill,
decorations, the groove border and the ~50 missing-triangle pixels all land in
the text tier or the strict 1% band).

## Results

`npm run verify:text-level-ua` exits 0 (3/3 fixtures, all layers). The full
`npm run verify` stays green after the UA rules, the inline-background and
decoration plumbing, the sub/sup shift and the fieldset legend land; the
existing `ua-styles` corpus (headings/lists/pre/hr/a) is unchanged.

## Divergences (declared)

- **`<q>` quote characters**: Chrome's html.css renders
  `q:before { content: open-quote }` / `q:after { content: close-quote }`. The
  engine's `content` supports only string values, so — per the task's explicit
  carve-out — `q` stays a plain inline element and the quote glyphs are a
  declared divergence: the fixture compares `q`'s computed styles but not its
  rect (Chrome's box includes the quotes), and the quote region falls under the
  text tier.
- **Closed `<details>` content placement**: a closed details renders only its
  summary box; Chrome places non-summary content outside the box (overlapping
  what follows), while the engine flows it in. The corpus therefore exercises
  closed details with no content below the summary and open details with
  content, keeping rect parity; the closed-with-content case is out of scope.
- **The disclosure marker triangle**: the summary's `::marker` triangle
  (`disclosure-closed`/`disclosure-open`) is not painted. The engine reproduces
  the computed list-item display/style and the marker's inline advance so the
  text position matches Chrome; the triangle's ~50 pixels sit within the strict
  1% screenshot band (details-summary fixture: 0.0956% exceeding).
- **`fieldset { min-inline-size: min-content }`** is not parsed; a fieldset
  narrower than its legend would not grow to the legend's width. The corpus
  fieldsets always stretch wider than their legends.
- **Culled-inline cross-run kerning**: Chrome merges an inline element with no
  visual effect (e.g. bare `abbr`) into the surrounding text segment, so its
  box includes the kerning with the following punctuation (an `abbr` before a
  period reports 2.5px less width). The engine measures each run standalone;
  the corpus avoids punctuation directly after a culled inline element.

## Out of scope (by design)

`abbr[title]`'s dotted underline, `q`'s quotes, the `:first-line`/
`::marker` interaction, and author-restyled fieldset legend layouts beyond the
shrink-to-fit straddle are not implemented; the corpus does not exercise them.