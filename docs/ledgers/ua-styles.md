# UA Stylesheet Defaults Ledger

Owning module: `src/cascade/ua.ts` (the UA stylesheet rules + per-element
resolution), applied at the lowest cascade origin by `src/layout/block-inline.ts`
(`resolveStyles`), corpus `corpus/ua-styles/`.

## Scope

The engine previously had no UA stylesheet: `package.json` claimed "UA
stylesheet" but every element resolved against the inherited defaults plus a
mini-UA display/table map in `block-inline.ts`. This task adds a real UA layer
mirroring Chromium's `html.css` for the subset the engine renders:

- `h1`–`h6`: font-size (`2em`/`1.5em`/`1.17em`/`1em`/`0.83em`/`0.67em`), bold
  weight, and their margin-block em values;
- `p` and lists (`ul`/`ol`): `1em` block margins, `ul`/`ol`
  `padding-inline-start: 40px`, `disc`/`decimal` list markers with `li` as
  `display: list-item`;
- nested-list rules: an inner list resets its block margins and steps the
  marker `disc` → `circle` → `square` by nesting depth (Blink's `:is(...)`
  selectors, expanded because the engine's selector matcher has no `:is()`);
- `strong`/`b` `font-weight: bolder`, `em`/`i`/`cite`/`var` `font-style: italic`;
- `pre`: monospace face + `white-space: pre`; `blockquote` 1em/40px margins;
  `hr` 0.5em margins + 1px inset border with `color: gray`;
- `a`: default link color `rgb(0, 0, 238)` + `text-decoration: underline`;
- `body` `margin: 8px`.

The UA layer is applied before the author stylesheet and inline styles, so any
author or inline declaration overrides it (the lowest-priority origin).

## Cascade mechanics

UA declarations are produced by `resolveUaDecls` (selector matching per
element, ascending specificity/source order) and merged as the base of the
existing first-declaration-wins cascade in `resolveStyles`:
`[...ua, ...author, ...inline].reverse()`.

To support the UA values, the engine gained:

- `em` lengths (font-size and margins), resolved against the parent / own
  font-size with 4-decimal rounding so computed values serialize like Chrome
  (`0.83 × 24px` → `19.92px`);
- `font-weight`/`font-style` in `ComputedStyle` (inherited), threaded into
  measurement and paint so bold/italic runs use the bold/italic faces (the
  chrome config registers the default family's `-Bold`/`-Italic` siblings);
- `line-height: normal` resolving to the font's rounded ascender+descender per
  family (Chrome's `normal` for Noto Sans at 16px is 22px, not the old hardcoded
  19px);
- `list-style-type` (inherited, initial `disc`) with disc/circle/square/decimal
  marker rasterization positioned like Chrome's list markers;
- `border-style: inset` with Blink's per-edge lighting
  (`Color::Light`/`Color::Dark`/`BlendWithWhite`) so hr's inset border
  rasterizes identically;
- logical longhands (`margin-block-start/end`, `margin-inline-start/end`,
  `padding-inline-start`), `border-width`/`border-style`/`border-color`
  shorthands, and `text-align: match-parent`;
- mixed inline+block content: consecutive inline items in a block are grouped
  into anonymous block boxes (needed for `<li>text<ul>…</ul></li>`).

## The `__qem` margin quirk

Blink writes heading/paragraph/list `margin-block-start` as `X__qem` — a
"quirky" margin. When the element is the first in-flow child of a parent with no
top border/padding, that quirky margin collapses through the parent: the child
sits flush with the parent's content top and the margin extends above the
parent's box. Author margins do not collapse this way. Implemented via a
`quirk` flag on the UA `margin-block-start` declarations, carried onto the
resolved margin; without it a bare `<h1>` would render 21.44px too low.

## Corpus (6 fixtures)

| Fixture | Covers |
| --- | --- |
| `bare-page` | the verification's `<h1>Title</h1><p>body</p>`: h1 `2em`/`0.67em` computed values + quirky-margin flush position |
| `bare-headings` | all six heading levels: font-size/margins/weight, computedStyle + rects |
| `bare-paragraphs` | p margins and sibling margin collapsing |
| `ul-ol-li` | ul/ol padding, disc/decimal markers, `display: list-item` |
| `nested-lists` | nested-list margin reset + disc → circle → square markers |
| `strong-em-pre-hr` | bold/italic runs, monospace pre, `a` underline, hr inset border |

Fixtures set `font-family: 'Noto Sans'` (font parity between the engine's
registered face and Chrome's fontconfig resolution, as every other corpus
fixture does); body margins are reset like the rest of the corpus.

## Results

`npm run verify:ua-styles` exits 0 — all 6 fixtures pass all four layers
(computedStyle exact, rects ≤ 0.5px, measureText sub-pixel, screenshots within
the charter §2/§10 bands). `npm run verify` (build + charter + spine + sweep +
cross-family) exits 0 after the UA layer lands.

## Divergences

- `pre` encodes Chrome's fixed-pitch default size (13px at the default 16px
  root) as `font-size: 0.8125em`; at a non-default root font-size the engine
  would not reproduce Chrome's generic-family size adjustment. The corpus uses
  the default root.
- The generic `monospace` family maps through the chrome config's fallback
  table to this machine's fontconfig monospace face (Hack Nerd Font); the
  fixture's pre text is a single line with no repeated whitespace, so
  `white-space: pre` rendering beyond collapsed single-line text is not
  exercised.
- Non-UA author margins on a first child do not collapse into a zero-margin
  parent (Chrome's `__qem` asymmetry); matching that would require threading
  the parent's own margin into the collapse, which no fixture needs.
- Form controls (`input`/`button`/`select`/`textarea`) get no UA styling
  ("where cheap" left them out): Chrome's appearance/border/background defaults
  are out of scope.
