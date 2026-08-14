# Pseudo-Elements Content Ledger

Owning modules: `src/cascade/selector.ts` (pseudo-element selector parsing),
`src/cascade/phases/media-queries.ts` (pseudo declaration routing),
`src/layout/css.ts` (`content` parsing, `PseudoBox`), `src/layout/block-inline.ts`
(pseudo box resolution + inline layout), corpus `corpus/pseudo-elements/`.

## Scope

`::before` / `::after` (and the legacy single-colon `:before` / `:after`) with
`content`-generated inline boxes. The selector engine previously skipped the
pseudo identifier (`selector.ts:85`), so `#x::after { content: '★' }` applied
to nothing. This task:

- parses `::before`/`::after` into the compound selector (single and double
  colon) and counts them as a type selector in specificity;
- routes a pseudo-targeting rule's declarations to the originating element's
  pseudo style, never to the element itself (the cascade's element map excludes
  them; `.a, .a::after { ... }` targets both independently);
- resolves each pseudo's computed style as an inline box inheriting the
  element's font/color/line-height and honoring author declarations
  (`color`, `font-size`, ...);
- parses `content`: `none`/`normal` → no box; `'text'`/`"text"` → a generated
  inline box laid out like normal inline content (::before leading, ::after
  trailing the element's own inline content);
- compares the generated glyphs in the screenshot diff under the documented
  text tier.

## Content model

`ComputedStyle.content` is `{ kind: 'none' } | { kind: 'text'; text }`.
`ComputedStyle.before`/`.after` are `PseudoBox | null` (null when no rule
targets the pseudo); `PseudoBox = { text: string | null; style: ComputedStyle }`
where `text: null` means content none/normal (no generated box) and `text: ''`
is still a generated box. Layout only generates a box when `text` is non-null;
an empty string produces no glyphs and, matching Chrome, does not force a line
box on an otherwise-empty element. `content` is non-inherited; the pseudo's
computed style is built from the element's resolved inherited properties plus
the pseudo's own declarations.

## Corpus (5 fixtures)

| Fixture | Covers |
| --- | --- |
| `after-suffix` | `::after` suffix text appended after the element's text; measure/rect/computed/screenshot all four layers |
| `before-prefix` | `::before` prefix (legacy single-colon `:before`) pushing the following span right |
| `content-none` | `content: none` vs `normal` vs `''` — all produce no box on an empty div (0px height) while computed `content` distinguishes `"none"` / `""` |
| `styled-pseudo` | pseudo with its own `color` + `font-size` overriding inherited values; font-family/line-height inherit; box grows for the larger glyph |
| `block-pseudo` | pseudo on a block element — the generated prefix opens the block's inline formatting context |

## Paint-layer handling (generated text under the text tier)

Chrome cannot report pseudo-element text fragments through
`Range.getClientRects()`, so the generated glyph regions are placed under the
documented text tier using the engine's own generated-text rects
(`out.generatedTextRects` — the line-box rects of elements that generate
content), padded 2px and unioned with Chrome's real-text fragments. The
non-text pixels (backgrounds, borders, the element box) are compared strictly:
0 exceeding pixels, worst ΔE 0.0000 across all fixtures.

## Results

`npm run verify:pseudo-elements` exits 0; all 5 fixtures pass all four layers.
Layer-3 rects match Chrome to ≤ 0.0069px (max Δ across the corpus); layer-1
measureText mean Δ ≤ 0.0044px; layer-2 computedStyle 0 mismatches. The engine
paints the same number of non-white pixels as Chrome in every fixture,
including the styled pseudo glyphs.

## Divergences

- `font-weight` on a pseudo is not exercised: the engine registers a single
  face per family (no bold file), so a bold pseudo would measure/paint regular
  and diverge from Chrome's bold glyphs. Out of scope (font-weight is a font
  task, not a generated-content one); fixtures avoid it.
- Pseudo content inside floats uses the float's single run style (color/font
  per-pseudo styling inside floats is not supported); not exercised by the
  corpus.
- `content` token types beyond strings (`attr()`, `url()`, `counter()`,
  `open-quote`, ...) parse as none; counters are a follow-on task.
