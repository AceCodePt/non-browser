---
wait_human_start: false
wait_human_merge: false
dependencies: [rect-total-for-nonrendered]
---

# Task: Refresh README + verifier so the rect contract matches current, tested code

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

After the rect-total-for-nonrendered fix, the README still describes the engine's rect behavior in a way that (a) was written before the fix and (b) is unverified by an automated gate. README.md line 112 claims `rects` maps "every id in the input to that element's border-box rect" and line 85 says `out.rects // layer 3: per-id border-box rects (getBoundingClientRect)`. The fix makes the map total (every DOM-present id yields a rect, with all-zero rects for non-rendered display:none/script/style ids), matching Blink's getBoundingClientRect. This task refreshes the README and the verification suite so the documentation reflects the current, tested behavior — and nothing else. It must not narrate a before/after (no "previously threw" / "now returns zeros"); the README should state only what the code does today. The measurement that backs it is the self-tested state proven by the rect-total-for-nonrendered spec plus a verifier that asserts the behavior so the claim cannot silently drift again. A search of archive/ found no existing task about refreshing the README/verifications to match current code, so this is a fresh task rather than a revival.

## Requirements

- [ ] Update README.md so the rects claims (the Output bullet around line 112 and the layer-3 line around line 85) state the current behavior exactly: every id present in the input DOM maps to a border-box rect, and elements that are not rendered (e.g. display:none and their descendants, script/style with an id) map to an all-zero rect — matching getBoundingClientRect. No mention of prior behavior.
- [ ] Add a verifier (a new scripts/verify-*.mjs wired into the verify suite) that renders a fixture containing a rendered id, a display:none id, a nested display:none descendant id, and an id'd script element, and asserts: rendered id returns its true border-box rect; the non-rendered ids return all-zero rects; no 'no rect collected' throw.
- [ ] Wire the new verifier into the npm package scripts (npm run verify and/or verify:all) so the README claim is backed by a gate that actually runs and must stay green.
- [ ] Ensure npm run build passes and the full existing verify suite (npm run verify, verify:all) stays green and unchanged apart from the newly added verifier.
- [ ] Keep the README parity/layer tables' existing measured numbers intact; add/refresh only the text describing the rect contract so it matches current code.

## Verification

npm run build passes. The new rect verifier (e.g. node scripts/verify-rect-contract.mjs) exits 0, and npm run verify / verify:all include it and exit 0. README.md's rect/layer-3 wording describes the current behavior (every input id -> border-box rect; non-rendered ids -> all-zero rect) with no before/after language, and the documented claim matches what the verifier and the rect-total-for-nonrendered spec actually prove.

## Prohibited Patterns

- Do not add any before/after narrative to docs (no 'this used to throw' / 'previously missing' / 'now returns zeros'). The README must describe only the current behavior, written as if it always was that way.
- Do not invent measurements or claims that are not backed by an actually run verify gate or by the self-tested behavior proven in rect-total-for-nonrendered; no fabricated parity numbers.
- Do not change engine behavior or geometry in this task — documentation and verification coverage only.
- Do not rewrite the README wholesale or touch unrelated sections; change only the rect/layout claims this task is about (and their verification).
- Do not add what-comments to code; any new code comments must explain why.
