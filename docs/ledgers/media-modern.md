# Media-Modern Ledger

Owning module: `src/cascade/media.ts` (mq4 §2.3 range syntax + device-
capability feature evaluation), `src/layout/render.ts` (`MediaInput` ->
`MediaEnvironment` threading). Corpus: `corpus/media-modern/`. Verification:
`scripts/verify-media-modern.mjs` (`npm run verify:media-modern`).

## Scope

- Range syntax per css-media-queries-4 §2.3: one-sided `(width >= 300px)` and
  value-first `(600px > width)` (the comparison flips when the feature sits
  right of the operator), two-sided `(400px < width <= 800px)` (an implicit
  `and` of both comparisons), and `=` as the exact-match operator. Extended to
  `(aspect-ratio >= 2/1)` and `(resolution >= 2x)` with ratio token handling.
- New device-capability features, all evaluated as eq / flag forms:
  hover, any-hover, pointer, any-pointer, prefers-contrast, forced-colors,
  color-gamut, update. min-/max- prefixed forms of these discrete features are
  rejected (matching Chrome, which accepts them only for rangable features).
- The environment inputs are explicit caller state (`MediaInput` in render.ts,
  `MediaEnvironment` in media.ts): hover/anyHover ('hover'|'none'), pointer/
  anyPointer ('fine'|'coarse'|'none'), prefersContrast ('no-preference'|
  'more'|'less'|'custom'), forcedColors ('active'|'none'), colorGamut
  ('srgb'|'p3'|'rec2020'), update ('fast'|'slow'|'none'). Defaults mirror
  headless desktop Chrome (probed): hover/any-hover hover, pointer/any-pointer
  fine, prefers-contrast no-preference, forced-colors none, color-gamut srgb,
  update fast.
- `==` tokenizes but is rejected in media context: Blink's stylesheet parser
  accepts `==` only inside @container (probed — `matchMedia('(width == 300px)')`
  serializes as valid, yet a `@media (width == 500px)` rule never applies; the
  corpus range-syntax fixture pins the dropped rule). The container parser
  keeps its own op table.

## Documented divergences (explicit, not silent)

- Oracle environment in this headless shell: CDP
  `Emulation.setEmulatedMedia` feature overrides work for prefers-contrast,
  forced-colors, and color-gamut, but the shell silently ignores hover,
  any-hover, pointer, any-pointer, and update overrides (the call succeeds,
  matchMedia keeps the desktop values). The hover/pointer corpus path
  therefore emulates a touch surface — `Emulation.setTouchEmulationEnabled` +
  mobile device metrics — which flips hover/any-hover to none and
  pointer/any-pointer to coarse in Chrome; the engine receives the identical
  values as explicit MediaEnvironment inputs. `update` stays at the desktop
  default (fast) in every oracle viewport; `(update: slow)` is exercised only
  as a false case (defaults-compose fixture).
- forced-colors emulation overrides author colors in Chrome (backgrounds,
  borders, text paint compute to the forced palette), so the
  contrast-forced-gamut fixture asserts sizing (width) rather than paint under
  `(forced-colors: active)`. The engine implements the feature query but not
  the forced-colors painting model (CanvasColors/backplate) — that surface has
  no owning slice and is excluded from v1 per the charter's UA/legacy scope.
