# Form controls — default rendering and static state pseudo-classes

`corpus/form-controls/` (gated by `npm run verify:form-controls`) pins the
engine's default form-control rendering against live headless Chrome: the UA
stylesheet values (`src/cascade/ua.ts`), the theme-painted appearance:auto look
and control metrics (`src/layout/controls.ts`), and the statically matched
form-state pseudo-classes `:checked` / `:disabled` / `:enabled`
(`src/cascade/selector.ts`). All four layers pass on every fixture: computed
styles exactly, rects ≤ 0.5px, non-text paint within the §10 band, label text
under the documented text tier.

## How Chrome's controls actually work (and what the engine mirrors)

Probing unstyled controls in headless Chrome shows the pattern the engine
reproduces: the computed style carries one set of values and the theme paints
another.

- **Text fields** compute `border: 2px inset rgb(118, 118, 118)` and paint a
  **1px solid #767676 frame** with the theme fill (white) covering the rest.
  The engine's text-field UA declarations carry Chrome's computed values; the
  1px frame is the `control` paint op.
- **Selects** compute `background-color: rgb(239, 239, 239)` (ButtonFace) but
  paint **white**; the disabled select paints the computed
  `rgba(239, 239, 239, 0.3)` washed over the page, which the engine reproduces
  by painting the computed color when disabled and theme white otherwise.
- **Buttons** compute `border: 2px outset rgb(0, 0, 0)` but paint a 1px
  #767676 frame with **~2px rounded corners** over the `#efefef` face.
- **Checkbox/radio** are 13×13 boxes with transparent computed backgrounds;
  the theme paints the frame/ring (gray 118 unchecked, #0075ff checked), the
  white checkmark (checkbox) and the inner dot (radio). Disabled controls
  paint the washed theme look (frames ~#d2d2d2, fills #f8f8f8, checked
  checkbox fill #e3e3e3, radio dot #d1d1d1).
- **Control baselines**: Chrome aligns a control in a line by its *internal*
  text baseline (the control font's ascent inside the padded content box);
  a checkbox/radio sits with its bottom border edge on the baseline. The
  engine's `atomicBaselineOffset` implements both (probed: a text input's
  neighbor text shares the input's inner baseline).

## Sizing formulas (probed at the default 13.3333px control font)

- Text input: content width = `(<size> + 2) × avgCharWidth + 1` (default
  `size` 20 → 177), where avgCharWidth is Blink's OS/2 xAvgCharWidth scaled
  and rounded to whole pixels (8.0 for Arial→Liberation Sans at 13.3333px).
  Content height = the font's ascender+descender sum rounded up (15).
- Textarea: content width = `round(<cols> × measure('0')) + 16` (cols 20 →
  176), content height = `<rows> × (rounded ascent + rounded descent)`
  (rows 2 × 15).
- Select: content width = `ceil(widest option text) + 20`, content height =
  rounded ascent + rounded descent + 2 (19 tall for the default font).
- Button: shrink-to-fit from the label (the element's text, or the input's
  `value` with the UA defaults `Submit`/`Reset`), height from the same
  ascender+descender metric as the text input.
- Checkbox/radio: fixed 13×13 border boxes with the UA margins
  (`3px 3px 3px 4px` checkbox, `3px 3px 0 5px` radio).

Known approximations, each outside the corpus's default-font surface: the
avgCharWidth rounding reproduces Chrome exactly at the default control font
sizes (13.3333px/20px) but can drift by ≤1px/char at large font sizes where
Blink's hinted-advance quantization behaves differently; a button with an
empty label collapses to its padding box instead of Chrome's strut-sized 21px.

## Static-state pseudo-classes

`:checked`, `:disabled` and `:enabled` match from the element's *attributes*
(Selectors §6.6.2/§6.6.4 static behavior): `checked` present on a
checkbox/radio input (or `selected` on an option), `disabled` present on an
enableable element (input, select, textarea, button, option, optgroup,
fieldset — a `disabled` div matches neither state, pinned by the states
fixture), `:enabled` the enableable complement. The disabled UA rules carry
Chrome's computed disabled colors (washed border/background alphas, the
rgb(84,84,84)/rgb(128,128,128)/rgba(16,16,16,0.3) text colors).

## Appearance:auto opt-out

A control with **any** author or inline declaration paints through the normal
CSS background/border path (`ComputedStyle.appearanceAuto` false), which is
what keeps the explicitly-styled controls of `corpus/stress/form` authoritative
over the UA defaults. Chrome switches a control to CSS painting per property
(e.g. only a background change); the engine's switch is per element — a
coarser heuristic, recorded here, that never affects fully unstyled controls.

## Value-label masks

An input button's label is shadow text: `Range.getClientRects()` reports
nothing, so the buttons fixture lists the control ids under
`harvest.maskContentBoxes` and the verify script derives the label's content
box from Chrome's own rect and computed border/padding, joining it to the
text-region tier with the other fragments. Frames and fills stay in the strict
non-text band.

## Out of scope for a static renderer (by design, not deferred silently)

- **Interaction**: focus, hover, active, value editing, dropdown opening —
  the renderer is static; `:focus`/`:hover`/`:active` never match.
- **Placeholder**: `:placeholder-shown` and placeholder text rendering are not
  implemented; no fixture proved Chrome parity is reachable for the empty
  control's placeholder paint through the theme, so placeholder is documented
  here instead.
- **Value text in text inputs**: `<input value="…">` paints nothing in the
  engine (the corpus keeps text inputs empty); button-ish inputs do paint
  their `value` label.
- **Number-input spin buttons**: Chrome's headless default paint shows no
  spinners (they are hover/interaction affordances), so the number input
  renders as a plain field.
- **Popup options**: a select renders its chosen option's text only; option
  elements generate no boxes (their rects map to the all-zero total-map
  entries, matching Chrome's non-laid-out options).
- **`size`/`cols`/`rows` beyond the attribute formula** and author-restyled
  control sizing: unstyled defaults are the claimed surface; author CSS wins
  wholesale via the opt-out above.
