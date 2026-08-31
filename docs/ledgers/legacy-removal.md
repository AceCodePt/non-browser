# Legacy Removal Ledger

Record of the modern-compat program's legacy-removal policy: deprecated HTML
elements and legacy CSS are **intentionally unsupported by design**, not
deferred gaps. They render as generic boxes, the engine intentionally diverges
from Chrome (which still styles them), and the divergence is declared on
`corpus/legacy-removal/legacy-elements` as a typed gap that the gate asserts
still diverges. The exclusions are stated in the README and charter §11.

## Removed surface

- **Deprecated HTML elements** — `center`, `tt`, `dir`, `menu`, `font`,
  `marquee`, `big`, `blink`, `strike`, `plaintext`, `xmp`, `nobr`. No UA
  stylesheet rule or element-list entry special-cases any of them; they resolve
  through the generic default-display logic (`src/layout/block-inline.ts`
  `defaultDisplayFor`) to `display: block`.
- **Presentational attributes** — `align`, `bgcolor`, `vspace`, `hspace`,
  `cellpadding`, `cellspacing`, table `width`/`height` are not consumed as
  presentational hints (CSS only).
- **Vendor-prefixed properties / legacy-only CSS** — `-webkit-*`, `-moz-*`,
  `-ms-*`, `zoom`, `display: run-in`, etc. are not implemented.

## What changed in `src/cascade/ua.ts`

- `center` removed from the block-display rule.
- `dir`/`menu` removed from the list rules (`LIST`, `LIST_INNER`,
  `MARKER_LIST`, the `ul, menu, dir` rule, and the nested circle/square marker
  rules). `ul`/`ol`/`dl` keep their modern list styling.
- `tt` removed from the monospace rule (`code`/`kbd`/`samp` keep monospace).

## Kept as current-Chrome parity (not legacy)

- Legacy comma `rgb()/rgba()` — current usage, kept alongside the modern
  space-separated syntax (program decision; not treated as legacy).
- The quirky `__qem` UA margin-collapse behavior — this is how Chrome renders
  `<body><p>` today, not a deprecated feature.

## Declared divergence

Chrome's UA stylesheet still styles the removed elements (`center` text-align
center, `tt` inline+monospace, `dir`/`menu` 40px list padding, `big`
inline+larger, `strike` inline+line-through). The engine intentionally renders
them as generic block boxes, so `corpus/legacy-removal/legacy-elements` declares
typed fail gaps on `computedStyle`, `rect`, and `screenshot` (measureText
passes — measurement is element-independent). `scripts/verify-legacy-removal.mjs`
asserts BOTH the engine-side generic-box contract AND that the divergence still
exists. The gaps carry a permanent sunset: they retire only if the policy is
reversed and Chrome's legacy defaults are reproduced.

## Verification

- `npm run verify:legacy-removal` — engine-side contract + Chrome-divergence
  gate (exit 0).
- `node scripts/check-charter.mjs` — exit 0 (coverage matrix and gap schema).