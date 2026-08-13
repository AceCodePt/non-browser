# Breakers Ledger

Owning seam: `@chenglou/pretext` prepare/layout over the Canvas interface's
measureText (`src/pretext/index.ts`), with the `OffscreenCanvas` shim that
routes Pretext's measurement through the generic Canvas interface. The spine's
line layout for its fixtures uses plain CSS `white-space: normal` greedy word
wrapping (`src/layout/measure.ts`), which matches Chrome's UAX#14 breaking for
the Latin corpus; Pretext-based breaking is wired at the seam and driven by the
text-breaker-parity task.

## Current behavior

- **Greedy word wrap** (`wrapWords` / `layoutTextLines`): breaks at space
  opportunities, fills each line to the available width; used for the block
  layout and (via the `available` callback) float-intrusion-aware widths.
- **Pretext seam**: `prepareText` / `layoutLines` run Pretext's prepare/layout
  with the same font string and registered fonts used at paint time.

## Method

`npm run verify:four-layer` additionally diffs Pretext's per-line widths
against Chrome's line-fragment widths for every text element (sub-pixel
`<=0.5px`, line counts must match), proving the seam produces Chrome-consistent
breaks.

## Results

Pretext seam passes on all five `corpus/spine/` fixtures (max line-width Δ
`<= 0.022px`; line counts identical to Chrome).

## Divergences

None recorded for the corpus. Known to the breaker track: hyphenation, CJK
break opportunities, `word-break`/`overflow-wrap` variants, and `white-space`
other than `normal` — each should be recorded here as it lands.
