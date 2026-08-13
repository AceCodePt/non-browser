# Paint-Text Ledger

Owning module: `src/layout/paint.ts` (text runs, letter-spacing, text-decoration
geometry), with `src/layout/fontmetrics.ts` (TTF hhea/post vertical metrics) and
the text-paint style properties in `src/layout/css.ts`. Corpus: `corpus/paint-text/`.

## Scope

Rasterization of text glyphs at layout-computed positions, riding Skia through
the Canvas interface (no hand-rolled glyph rasterization, no re-measurement at
paint time). Each layout line is drawn at its line-box x / baseline with the same
font resolution and registered fonts used at measure time. In scope:

- **letter-spacing** — applied at measure time for line breaking (width =
  `ctx.measureText` + `ls * charCount`, matching Blink, which adds the spacing
  after the trailing character too) and at paint time by placing each glyph at
  its shaped prefix advance plus the accumulated spacing, so kerning is
  preserved. Negative values supported.
- **text-decoration** — underline / line-through / overline, solid style, with
  per-element `text-decoration-color` (default `currentColor`), `from-font`
  / px thickness, and `text-underline-offset`. Geometry replicates Blink's
  `TextDecorationInfo`/`TextDecorationOffset` algorithm exactly: each line's
  decoration spans the line's used text width and is positioned from the font's
  rounded ascent/descent content box (`contentTop = lineTop + (lineHeight -
  round(ascent) - round(descent)) / 2`), using `post` underline thickness for
  `from-font` and the `fs/10` auto thickness, floored to device pixels at paint.
- **Text fill color and opacity** — from computed styles; `color` may carry an
  alpha channel (rgba), applied through the canvas fill style.

Out of scope (unchanged): decoration styles other than solid (double/dotted/
dashed/wavy), `text-decoration-skip-ink`, the element-level `opacity` property
(compositing), and background-image/effects.

## Corpus (9 fixtures)

| Fixture | Covers |
| --- | --- |
| `underline` | underline at two sizes, color override, text-underline-offset |
| `line-through` | line-through across sizes, thickness 2px, color override |
| `overline` | overline at two sizes (including above the em box) |
| `decorations-mixed` | underline + line-through + overline combined, per-element colors |
| `letter-spacing` | positive 3px, 2px and negative -0.5px spacing, wrapping at a fixed width |
| `letter-spacing-decorations` | letter-spacing + underline / strike+overline (decoration spans the spaced advance) |
| `colors` | named/hex/rgba fill colors, decoration color = currentColor |
| `sizes` | underline geometry across 12/16/24/32px |
| `multiline` | wrapping underlined paragraph, one decoration per line |

## Paint-layer masking (known divergence)

As in the floats/grid corpora, Chrome's Skia rasterizes glyph coverage slightly
differently than `@napi-rs/canvas`, so text glyph ink exceeds the per-pixel
delta-E. Text is therefore masked on the paint layer (masks generated from
Chrome's own line-fragment rects, padded 2px). Text-decoration lines sit inside
those same line fragments, so they are masked too. Everything else — line boxes,
backgrounds, borders, and the letterspaced layout extents — is compared strictly:
every fixture's screenshot row reports 0 exceeding pixels.

Decoration geometry was additionally verified pixel-for-pixel against headless
Chrome across font sizes 14/20/28/40 and line-heights 21/30/50 before the corpus
was committed (underline/strike/overline row positions match exactly).

## Results

`npm run verify:paint-text` exits 0. All 9 fixtures pass all four layers:
layer-3 rects match Chrome to <= 0.01px max Δ, layer-4 worst ΔE 0.0000 with 0
exceeding pixels in every fixture (masked text aside). The reference
`reference.json`/`reference.png`/`mask.png` are harvested live from Chrome by the
verify script and committed as golden data; `candidate.*` is the engine's output.
`npm run verify:layout-grid` (13/13) and `npm run verify:layout-floats` (10/10)
still exit 0 — no regressions in the sibling layout modules.

## Divergences

None in the verified surface. Not covered by this task: non-solid decoration
styles, text-decoration-skip-ink, element-level `opacity` compositing,
`white-space` variants other than `normal` interplay with letter-spacing, and
`text-underline-position: from-font` (the default `auto` position is used).
