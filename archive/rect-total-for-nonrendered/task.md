---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Backfill zero rects for non-rendered ids so the rect map is total

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

A developer running "classic layout tests" hit `layout: no rect collected for id(s): bar, baz`. Root cause: two walks disagree. `collectIds` (src/layout/render.ts:339) walks the DOM and records every element's id; `collectRects` (src/layout/block-inline.ts:667) walks the layout tree and records border-box rects only for nodes that were actually laid out. Children with `display: none` are skipped with a bare `continue` at src/layout/block-inline.ts:1376 (and script/style etc. never become layout nodes), so an id'd element inside a `display:none` subtree, or a `script`/`style` element with an id, has an id collected but no rect. The checks then throw: src/layout/render.ts:171 (assertIdsHaveRects, used by rectsOf) and src/layout/paint.ts:489 (used by renderHtml). This violates the documented contract at src/layout/paint.ts:3 ("collect getBoundingClientRect values for every element with an id") and Blink parity: in Chrome `getBoundingClientRect()` on a display:none element returns an all-zero rect rather than throwing.

## Requirements

- [ ] Make the rect map total: every id collected by collectIds must appear in root.rects, so assertIdsHaveRects (render.ts) and the paint check (paint.ts) never throw for a DOM-present id.
- [ ] Non-rendered elements (display:none and their descendants, plus void/non-layout elements like script/style that carry an id) must get a zero rect (x:0, y:0, width:0, height:0), matching Blink's getBoundingClientRect behavior for unrendered boxes.
- [ ] Do the backfill once in a single place on the prepare/converge path so both renderHtml and rectsOf benefit; do not special-case each call site.
- [ ] Existing rendered ids must still report their true border-box rects (no behavior change for rendered elements).
- [ ] The full verification suite (npm run verify, all verify:* gates, check-charter) stays green and unchanged for existing parity fixtures.
- [ ] Add a regression case: renderHtml and rectsOf of a fixture with an id'd display:none element (and an id'd script element) return the zero rect for those ids instead of throwing.

## Verification

node --input-type=module with the public API: rendering a fixture like `<div id="bar"><div id="baz">content</div><div id="qux" style="display:none">hidden</div></div>` plus `<script id="s">` returns rects for bar/baz/qux/s with qux and s being all-zero (x:0,y:0,width:0,height:0), and neither renderHtml nor rectsOf throws `no rect collected`. A rendered id still returns its true border box. npm run build passes; npm run verify and the verify:* gates and check-charter remain green.

## Prohibited Patterns

- Do not change layout geometry or paint output for rendered elements — the fix is a totalization backfill only.
- Do not change the throw-on-unknown-id semantics of computedStyle (that is a different contract); only id->rect lookup for DOM-present ids.
- Do not special-case each call site; backfill once on the shared prepare/converge path.
- Do not add what-comments; any comment must explain why (Blink parity, contract at paint.ts:3).
