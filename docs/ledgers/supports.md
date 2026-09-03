# Supports Ledger

Owning module: `src/cascade/supports.ts` (@supports condition grammar +
evaluation against the engine's property surface),
`src/cascade/stylesheet.ts` (@supports parsing, parse-time evaluation, block
inclusion). Corpus: `corpus/supports/`. Verification:
`scripts/verify-supports.mjs` (`npm run verify:supports`).

## Scope

- Declaration conditions `(property: value)` evaluate against the engine's
  real surface: every validator reuses the same parser makeStyle will run for
  that property (parseColorOrNull, parseLength, parseMathValue, parseTrackList,
  parseTemplateAreas, parseShadowList, keyword tables). A condition the engine
  cannot truthfully honor evaluates false and the whole block drops — parse
  time, since conditions are viewport-independent.
- Custom-property conditions (`--x: 1`) are true for any non-empty value
  (css-variables-1: any value is valid for a custom name).
- not / and / or compose with css-conditional-3 §4.1 precedence
  (or → and → not), parenthesized grouping, and nested `not` inside parens.
- Shorthand conditions evaluate like the component value makeStyle consumes:
  `border` (length/style/color parts), `margin`/`padding`/`inset` (1-4
  lengths), `flex`, `font`, `list-style`, `background`. `background` is
  honored only as a color today (no image/gradient surface yet), so
  `@supports (background: url(x))` is false here though Chrome says true.
- `@supports` nests inside `@media` and `@media` inside `@supports`; the
  enclosing media/container state threads through untouched.

## Documented divergences (explicit, not silent)

- Conditions over features Chrome supports but the engine lacks (e.g.
  `filter`, `outline`, `background: url(...)`, `display: contents`) evaluate
  false: Chrome applies those blocks, this engine drops them. This is the
  truthful feature-query semantics for this engine — each such surface has an
  owning pending slice, and when it lands the condition flips to true with no
  parser change (the validator table reuses the live parsers).
- Units parseLength does not resolve (cm, mm, in, pt, pc, ex, ch, q) evaluate
  false for length conditions even though Chrome supports them.
- `@supports selector(...)`, `font-tech()`, `font-format()` are treated as
  general-enclosed (false); Chrome evaluates them true where supported.
- `(property)` flag form without a value is general-enclosed → false (Chrome
  agrees: `CSS.supports('color')` is false).
