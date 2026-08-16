# Lists-Markers Ledger

Owning module: marker geometry in `src/layout/block-inline.ts`
(`listMarkerFor`, `insideMarkerAdvanceFor`, `markerShape`) and marker paint in
`src/layout/paint.ts` (`paintListMarker`); `list-style-type`/`list-style-position`
parsing in `src/layout/css.ts`; corpus `corpus/lists/`.

## Scope

The UA stylesheet task supplied the baseline list defaults (`ul`/`ol`
`padding-inline-start: 40px`, `disc`/`decimal`, `li { display: list-item }`).
This task makes the markers real and Chrome-exact:

- `list-style-type` for `ul`/`ol`/`li`: `disc`, `circle`, `square`, `decimal`,
  `decimal-leading-zero`, `none` (inherited, initial `disc`), exposed through
  `getComputedStyle` (layer-2 exact).
- `list-style-position: inside | outside` (inherited, initial `outside`),
  exposed through `getComputedStyle`. Outside is the default: the marker hangs
  in the list gutter. Inside moves the marker box into the item's content box
  at the start of the first line, and the first line's text is pushed right by
  the marker advance (23px for the 16px Noto Sans disc, the counter-text width
  for decimal).
- Ordered lists renumber: an `ol`'s `li` children count 1, 2, 3, and a nested
  `ol` restarts at 1 (each list's `layoutBlockChildren` keeps its own counter).

## Geometry (Blink source, `list_marker.cc`)

The engine's marker boxes mirror Blink's exactly rather than approximating:

- **Symbol markers** (`disc`/`circle`/`square`) are sized from the font's
  rounded ascent: `offset = ⌊ascent·2/3⌋`,
  `bulletWidth = ⌊(offset+1)/2⌋` (`RelativeSymbolMarkerRect`), box
  `symbolWidth = bulletWidth + 2` (`WidthOfSymbol`). For Noto Sans at 16px
  (ascent 17): bulletWidth 6, symbolWidth 8.
  - **Outside**: the marker box sits `offset + 8` px left of the li's border
    box (`InlineMarginsForOutside`), the shape box starts 1px inside it, so the
    shape center is `borderX − offset − 7 + bulletWidth/2` = `borderX − 15` at
    16px. Vertical center is `lineTop + 3·(ascent−offset)/2 + bulletWidth/2`
    (`RelativeSymbolMarkerRect` y), not the line box's vertical middle.
  - **Inside**: the box starts 1px before the content box (margin −1) with a
    `1em` end margin, so the advance is `−1 + symbolWidth + fontSize` (23px at
    16px) and the shape center is `contentX + bulletWidth/2`.
  - **Paint**: `disc` = filled circle radius `bulletWidth/2`, `square` = filled
    `bulletWidth` rect, `circle` = ring of outer radius `bulletWidth/2` and
    inner `bulletWidth/4` (Blink's 1px outline).
- **Decimal markers** render the counter with Chrome's default suffix
  `. ` (`GenerateRepresentationWithPrefixAndSuffix`); `decimal-leading-zero`
  pads to two digits. Outside the text is right-aligned to the li's border box
  (`x = borderX − textWidth`); inside it is left-aligned to the content box and
  its width (`"1. "` = 17.6094px at 16px) is the first-line advance. The
  baseline is the li's first-line baseline.

## The inside-marker first-line shift

An inside marker is an inline box at the start of the item's first line. The
marker's advance is staged in `layoutBlockChildren` (module-level
`insideMarkerAdvance`/`insideMarkerOwner`, cleared after the item's layout) and
consumed by `layoutInlineContent`, which shifts `lines[0].x` by the advance
before the text paint op is created — so both `node.lines` and the paint op
reflect the shift, and the marker paints as a separate op at the first line's
start (never baked into the li's text runs). Only the first line shifts;
subsequent wrapped lines return to the content box, matching Chrome.

## Numbering verification

`getComputedStyle(li, '::marker').content` returns `normal` in Chrome, so the
marker text is harvested via CDP `DOMSnapshot.captureSnapshot`: the marker
box's text run appears in the layout tree keyed by the `::marker` pseudo's
backend node. `scripts/verify-lists.mjs` compares each fixture `li`'s Chrome
`::marker` text (trimmed) against the engine's rendered counter text and fails
on a mismatch — including the nested fixture, where the inner ol must report
`1. `, `2. ` while the outer li reports `2. `.

## Corpus (5 fixtures)

| Fixture | Covers |
| --- | --- |
| `basic-ul` | disc default + author-set square/circle (ul and per-li `list-style-type`), computed values, raster |
| `basic-ol` | decimal counters 1./2./3., `::marker` text == engine, first-line x |
| `nested` | ol-in-ol renumbering (restarts at 1), ul-in-ul disc → circle → square, rects |
| `inside-position` | `list-style-position: inside` for ul (23px disc advance) and ol (counter-text advance), shifted first-line x |
| `none-marker` | `list-style-type: none` — no marker box, no `::marker` text, no gutter advance |

All fixtures use the default 16px Noto Sans font and reset body margins like the
rest of the corpus. `npm run verify:lists` exits 0 (four layers + line-box x +
marker numbering); `npm run verify:ua-styles` stays green with the corrected
marker geometry.

## Divergences

- The geometric marker advance formula is validated for Noto Sans (the corpus
  font) across font sizes; other fonts resolve through the same ascent-based
  Blink formulas but are not corpus-covered.
- A list-item whose first child is a block (no leading inline content) does not
  shift a first line for an inside marker (there is no inline line to shift);
  the marker still paints at the content start.
- `list-style-type` values beyond the required set (e.g. `upper-alpha`, `lower-roman`)
  compute but render as no marker; only disc/circle/square/decimal/
  decimal-leading-zero are drawn.
