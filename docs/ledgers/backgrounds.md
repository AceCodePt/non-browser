# Backgrounds ledger

Paint surface for css-backgrounds-3 / css-images-3 background layers: gradient
generation, the full `background` shorthand, per-layer size/position/repeat and
clip/origin, and stacked layers. Corpus: `corpus/backgrounds/` (verify with
`npm run verify:backgrounds`), charter §11 rows "background-image gradients"
and "background layers".

## Implemented

- `linear-gradient()` / `repeating-linear-gradient()`: `<angle>` and
  `to <side>/<corner>` directions (the corner gradient line is perpendicular to
  the adjacent-corner diagonal, css-images-3 §3.4.1.1 — box-aspect dependent),
  stops with lengths/percentages/double positions, hard stops, and the
  color-stop fixup (edge pinning, midway spreading, non-decreasing clamp).
- `radial-gradient()` / `repeating-radial-gradient()`: `circle`/`ellipse`,
  `closest-/farthest-corner/side` sizing (corner ellipses solve the
  through-the-corner constraint in unit-square space, matching Blink's
  ComputeEndRadii), explicit radii (one radius = circle), `at <position>`.
- Layer list parsing/cycling (css-backgrounds-3 §9.1), `background-size`
  (lengths/percentages/`auto`/`cover`/`contain`), `background-position`
  (keywords, lengths, percentages, offset-from-edge), `background-repeat`
  (`repeat`/`no-repeat`/`round`/`space`/`repeat-x`/`repeat-y` two-value forms),
  `background-clip`/`background-origin` (border/padding/content box, radii
  adjusted per box, the color painting within the last layer's clip region),
  `background-attachment` (fixed positions the image in the viewport at scroll
  0), and the full `background` shorthand.
- Computed-value serialization matches Chrome CSSOM exactly (verified
  fixture-by-fixture): gradient stop units survive (`0px` vs `0%`), the initial
  direction (`to bottom`) and `farthest-corner` drop, `50% auto` collapses to
  `50%`, `repeat no-repeat` collapses to `repeat-x`, and the shorthand prints
  `color image repeat attachment position / size origin clip`.
- Chrome interpolates CSS gradients premultiplied (css-images-3 §3.4); Skia's
  canvas gradient interpolates straight, so zero-alpha stops keep their rgb and
  segments whose endpoints differ in both rgb and alpha are refined with
  samples of the premultiplied curve (src/layout/background.ts `canvasStops`).
  Verified: multi-color alpha ramps rasterize within ΔE ≤ 2 of Chrome.

## Not supported (explicit)

- **url() raster backgrounds** — chartered-out raster image decode. url() in
  `background-image`/`background` **parses and serializes** (computed values
  keep `url("...")`, never silently dropped) but paints nothing, matching
  Chrome's rendering of an unresolvable URL. `corpus/backgrounds/url-unsupported`
  pins this contract.
- Vendor-prefixed gradients (`-webkit-linear-gradient`, ...) — not parsed; the
  engine targets modern-only syntax (charter "Legacy HTML elements and legacy
  CSS").
- Modern color-interpolation-method syntax (`in oklab`, ...) — not parsed; no
  fixture proves Chrome parity for it.
- `background-clip: text` and element() — not parsed.
