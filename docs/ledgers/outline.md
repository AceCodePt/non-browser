# Outline Ledger

Owning module: `src/layout/css.ts` (parse + computed values), `src/layout/computed-style.ts`
(serialization), `src/layout/block-inline.ts` (paint-op emission), `src/layout/paint.ts`
(the `// ===== outline` painter), corpus `corpus/outline/`.

## Scope

css-ui-4 §4: `outline-width` (thin/medium/thick/length, clamped ≥ 0),
`outline-style` (none/hidden/auto/dotted/dashed/solid/double/groove/ridge/inset/outset),
`outline-color` (color + `auto`/`invert` resolving to currentColor), `outline-offset`
(length, negative clamped per axis to −⌊dimension/2⌋), and the `outline` shorthand
(width/style/color in any order; `hidden` is not in the shorthand grammar and
invalidates the declaration, matching Chrome). Verified against Chrome on layer 2
(getComputedStyle string equality incl. the shorthand serializing color, style,
width and never offset), layer 3, and layer 4 (screenshot within the §10 band).
Outline is paint-only: the verify script re-renders every fixture with the outline
declarations stripped and requires the rect map byte-identical (layout blindness).

## Paint model (probed against Chrome + OutlinePainter.cc)

- The ring occupies [offset, offset+width] outside the pixel-snapped border box;
  corner radii grow by the outset (outer = r+offset+width, inner = r+offset,
  re-reduced against each rect); the center line = outer shrunk by ⌊width/2⌋.
- Solid/double/groove/ridge/inset/outset fill the ring (double splits into
  third-bands; groove/ridge paint Chrome's two-tone top/left vs bottom/right
  scheme with `color.Dark()` — an approximation, not corpus-claimed).
- Dashed/dotted straight edges: per-edge chains (Chrome restarts the pattern per
  edge and extends each edge into the corners by (w+1)/2). Dotted w ≤ 3 draws
  w×w butt squares via Chrome's EnforceDotsAtEndpoints endpoint rules; dotted
  w ≥ 4 draws round-cap circles of diameter w with the endpoints moved in by
  w/2; corners where two edges' end dots coincide double-blend exactly like
  Chrome's two DrawLine calls. Dashes: [3w,2w]-pattern for w ≤ 2, [2w,w] for
  w ≥ 3, anchored at the outer edge, period fitted so n whole periods span
  span + 2w + 4.
- Dashed/dotted rounded corners: one continuous chain along the center contour
  (starting at the top-left arc, Chrome's contour order), period fitted to
  round(len/period0) intervals, opening with the gap so the seam never cuts a
  dash; dotted places diameter-w circles half a period in.
- Outline paints after the element's own text (Chrome's kOutline phase) and is
  never clipped by the element's own overflow clip; it carries its pre-clip
  ancestor clip instead.

## Declared divergences

- `outline-style: auto` computes to `auto` but paints nothing. Chrome paints a
  focus ring; the engine has no focus-ring design (css-ui-4 leaves its appearance
  implementation-defined). No fixture claims it.
- `outline-color: invert` computes to currentColor (Chrome's modern behavior);
  the legacy pixel-inversion mode is not modeled.
- groove/ridge/inset/outset are painted two-tone per Chrome's OutlinePainter
  scheme but have no corpus fixture pinning their shading.

## Corpus (7 fixtures)

solid, dashed (w 2 + 4), dotted (w 2 + 4), offset (incl. negative), radius
(solid over border-radius), radius-dash-dot (dashed over border-radius + dotted),
shorthand (6 shorthand forms + computed-style surface).

## Verification

- `node scripts/verify-outline.mjs` → **exit 0** (4 layers vs Chrome + the
  outline-blindness rect gate).
- `npm run build`, `node scripts/check-charter.mjs` → exit 0 with the §11 row.
