---
wait_human_start: false
wait_human_merge: false
dependencies: [text-measure-corpus]
---

# Task: Fix review findings: Pretext in the engine path, harness gate correctness, cross-module consistency

## Metadata

- **Complexity:** High
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Post-merge code review of the scaffold..HEAD diff surfaced two classes of problems. Spec/correctness: (1) @chenglou/pretext is only a test seam — the engine's real text layout is a hand-rolled greedy wrapper in src/layout/measure.ts (charter §3), (2) verify-four-layer.mjs:219 gates only on per-string maxPx and never enforces the charter's <0.01px mean, (3) :225-226 blanket-masks all text from the screenshot diff so glyph rasterization is never compared even though both sides rasterize via Skia, (4) :172-175 parses the fixture font by regex and drops weight/letter-spacing. Consistency: three divergent baseline formulas (block-inline.ts:564, flexbox.ts:52-56 hard-coded Noto fractions ignoring the browser config, paint.ts:62 via fontmetrics.ts); node predicates/lenPx/clamp/font-string building duplicated across flexbox/grid/measure/paint; five ~160-line near-identical verify-*.mjs templates; tolerances.ts:67 dead 'exact'?:'exact' branch; package.json stale name and scripts pointing at archived files; unused path primitives in the Canvas interface.

## Requirements

- [ ] Pretext is the engine's text layout, not a test seam: src/layout/measure.ts line/word wrapping runs through the @chenglou/pretext prepare/layout pipeline over the Canvas interface, and the harness (verify-four-layer.mjs) stops carrying its own Pretext call.
- [ ] Layer-1 mean tolerance is enforced: verify-four-layer.mjs and verify-text-measure.mjs fail when the computed meanDelta >= 0.01px, not just when a per-string maxPx is exceeded.
- [ ] Text is unmasked in the screenshot diff by default; masks remain only for documented regions (e.g. antialiased glyph edges, <img> rects) declared via the fixture mask mechanism, so the paint layer actually tests glyph rasterization.
- [ ] Layer-1 fixture fonts preserve full spec: weight/style/letter-spacing from the fixture font string reach measureText instead of being dropped by regex parsing.
- [ ] Single baseline authority: one baseline computation in src/layout/fontmetrics.ts is used by block-inline, flexbox and paint; flexbox drops the hard-coded FONT_ASCENT_FRAC/FONT_DESCENT_FRAC (1069/1000, 293/1000) and honors the active browser config.
- [ ] Shared helpers consolidated: node predicates, lenPx/clamp, and the font-string builder live in one shared module and are imported by flexbox, grid, block-inline, measure and paint (no copies remain).
- [ ] Verify scripts parametrized: the near-identical verify-layout-grid/flexbox/positioning, verify-paint-text and verify-four-layer templates collapse into one shared runner or shared lib so a tolerance change touches one place.
- [ ] tolerances.ts:67 tautology removed: the `mode === 'exact' ? 'exact' : 'exact'` branch becomes real validation or is deleted.
- [ ] package.json hygiene: name/description reflect the non-browser scope; scripts pointing at nonexistent files (verify:cascade-core -> verify-cascade-core.mjs, harvest:cascade-core -> harvest-computed.mjs) are removed or repointed at real scripts.
- [ ] Dead code removed: unused path primitives (beginPath/moveTo/lineTo/closePath/fillPath/strokePath) are removed from the Canvas interface and skia impl unless a consumer exists; the @container evaluation is kept only if deliberately justified in the task's report, else removed.

## Verification

npm run build passes (tsc strict). npm run verify (four-layer) is green with the enforced mean tolerance and unmasked text (masks only for declared regions). npm run verify:text-measure is green with the <0.01px mean enforced. verify:layout-flexbox, verify:layout-grid, verify:layout-positioning, verify:paint-text, verify:media-queries all green after script parametrization. grep across src/ shows no duplicated node predicates, lenPx/clamp, or font-string builders outside the shared helpers, and no baseline formula other than the fontmetrics.ts authority. package.json contains no scripts pointing at nonexistent files.

## Prohibited Patterns

- Do not weaken charter tolerances to make diffs pass.
- Do not edit corpus fixtures to force a green result.
- Do not reintroduce skia-specific types into the Canvas interface.
- Do not touch text-measure-corpus's uncommitted work; this task runs after it archives.
