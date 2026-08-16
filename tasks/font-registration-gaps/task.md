---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Register the missing Thai + emoji faces and close the two worst layer-1 measurement gaps

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Parity analysis: the two worst layer-1 (measureText) deltas in the corpus are the Thai run (146.0px) and the emoji-smiley string (22.2px) in corpus/measure-corpus/known-gaps (docs/ledgers/text-measure.md). Both are font-resolution gaps, not shaping gaps: no Thai or emoji-capable face is installed/registered, so skia keeps the missing glyphs in the declared font while Chrome's fontconfig falls back to a face the engine never registers. Both sides ride HarfBuzz, so registering the same faces Chrome resolves closes the gap to sub-pixel. Closing a gap means flipping the typed known-gaps entry to pass — the fixture asserts the divergence still exists, so the entry must genuinely close. Also fixes the machine-calibration issue: src/config/chrome.ts hard-codes /home/sagi font paths, so the registration set must reproduce off this machine via config/env.

## Requirements

- [ ] Install a Thai-capable face (e.g. Noto Sans Thai) and an emoji-capable face (e.g. Noto Color Emoji) at user level (~/.local/share/fonts), refresh fontconfig (fc-cache), and confirm Chrome's ctx.measureText for the two gap strings resolves through the new faces.
- [ ] Register the same faces in the engine font set (src/config/chrome.ts) and add fallback-table entries so CSS families resolve to them deterministically, matching Chrome's resolution to sub-pixel (charter §4).
- [ ] Remove the hard-coded /home/sagi absolute font paths from src/config/chrome.ts; resolve registration paths via config/env with graceful fallback so the set reproduces on another machine.
- [ ] Flip the Thai and emoji-smiley entries in corpus/measure-corpus/known-gaps/fixture.json out of the fail list and add equivalent pass strings to the Thai/emoji pass categories (e.g. corpus/measure-corpus/rtl and emoji), deleting their divergence declarations.
- [ ] Update docs/ledgers/text-measure.md: known-gaps count 7 → 5, record the reclassified strings and their post-fix deltas.

## Verification

npm run build passes. npm run verify:text-measure is green with the Thai and emoji-smiley strings in the pass corpus (known-gaps count 5) and their deltas ≤ 0.5px (mean within charter tolerance). npm run check-charter green. Grep confirms no hard-coded /home/sagi path remains in src/config.

## Prohibited Patterns

- Do not weaken the layer-1 tolerance (mean ≤ 0.01px, max ≤ 0.5px) to make the fixtures pass.
- Do not delete a known-gaps entry without its divergence first closing — the fixture asserts each still diverges, so deleting a still-diverging entry fails verify.
- Do not add a fallback-table entry whose advances don't reproduce Chrome's to sub-pixel.
- Do not install fonts system-wide with sudo; user-level install keeps the environment reproducible.
- Do not change color-emoji rasterization expectations — this task is measurement (layer 1) only; text-pixel divergence stays under the existing tiered tolerance.
