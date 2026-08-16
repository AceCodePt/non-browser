---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: REDO (archived empty): register Thai + emoji faces, close the two worst layer-1 gaps, de-machine-calibrate font paths

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

The original font-registration-gaps spec (Thai + emoji faces, close the two worst layer-1 gaps) was archived by the daemon WITHOUT execution — its work is absent (corpus/measure-corpus/known-gaps still lists all 7 entries, src/config/chrome.ts registers no Thai/emoji face, and the /home/sagi machine-calibration remains). That empty archive happened because `npm run verify` stays green on unchanged code: the typed known-gaps assert their divergences still exist, so a no-op agent passes the default acceptance hook. This is the redo, gated by scripts/verify-font-registration.mjs so the acceptance hook (session-idle case *font-registration*) genuinely requires: Thai + emoji faces registered, no /home paths in src/config, and the Thai/emoji entries reclassified out of known-gaps. Numerical parity of the reclassified strings is then proven by verify:text-measure.

## Requirements

- [ ] Install a Thai-capable face (e.g. Noto Sans Thai) and an emoji-capable face (e.g. Noto Color Emoji) at user level (~/.local/share/fonts), refresh fontconfig (fc-cache), and confirm Chrome's ctx.measureText for the two gap strings resolves through the new faces.
- [ ] Register the same faces in the engine font set (src/config/chrome.ts) and add fallback-table entries so CSS families resolve to them deterministically, matching Chrome's resolution to sub-pixel (charter §4).
- [ ] Remove the remaining hard-coded /home/sagi font paths from src/config (e.g. chrome.ts HACK_MONO), resolving registration paths via config/env with graceful fallback so the set reproduces on another machine.
- [ ] Flip the Thai and emoji-smiley entries in corpus/measure-corpus/known-gaps/fixture.json into the pass corpus (add equivalent strings to pass categories), deleting their divergence declarations.
- [ ] Update docs/ledgers/text-measure.md: known-gaps count 7 → 5, record the reclassified strings and their post-fix deltas.
- [ ] scripts/verify-font-registration.mjs exits 0 (faces registered, no /home paths, gap entries reclassified) — this is the daemon's acceptance gate.

## Verification

npm run build passes. node scripts/verify-font-registration.mjs exits 0. npm run verify:text-measure green with the Thai and emoji-smiley strings in the pass corpus (known-gaps count 5) and their deltas ≤ 0.5px (mean within charter tolerance). npm run check-charter green.

## Prohibited Patterns

- Do not weaken the layer-1 tolerance (mean ≤ 0.01px, max ≤ 0.5px) to make the fixtures pass.
- Do not delete a known-gaps entry without its divergence first closing — the verify:text-measure script asserts each remaining entry still diverges.
- Do not add a fallback-table entry whose advances don't reproduce Chrome's to sub-pixel.
- Do not install fonts system-wide with sudo; user-level install (~/.local/share/fonts + fc-cache) keeps the environment reproducible.
- Do not finish before scripts/verify-font-registration.mjs passes — that gate IS the daemon's acceptance.
