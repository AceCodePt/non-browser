---
wait_human_start: false
wait_human_merge: false
dependencies: [browser-compat-modern]
---

# Task: Forced line breaks: <br> and <wbr> in inline layout

## Metadata

- **Complexity:** Low
- **Priority:** High
- **Status:** Ready for Handoff

## Context

Verified empirically against the built engine: <p>one<br>two</p> renders ONE line fragment containing "one two" — <br> is in INLINE_TAGS (src/layout/block-inline.ts:63) but nothing turns it into a forced break. buildPieces treats it as an empty inline element that contributes nothing (block-inline.ts:1900-1945). <wbr> likewise has no effect. <br> appears in nearly every real document, so this is one of the highest-frequency correctness gaps in the program.

## Requirements

- [ ] <br> forces a line break in inline layout: the inline content before it closes the current line and content after starts the next line, matching Chrome's line fragments.
- [ ] <wbr> is a zero-width opportunity break point: the breaker may break there but does not have to, matching Chrome.
- [ ] Forced breaks interact correctly with text-align (the line before a <br> is laid out at its alignment edge, not justified), white-space modes, and list markers (a <br> inside a list item does not reset the marker).
- [ ] Rects/text fragments: <p>one<br>two</p> yields two line fragments whose combined geometry matches Chrome's Range.getClientRects().
- [ ] Corpus under corpus/br-wbr/ exercises plain <br>, consecutive <br>, <wbr> in long words, and <br> in lists; verify script scripts/verify-br-wbr.mjs compares line fragments and rects against Chrome; a charter §11 row with a corpus token is added.

## Verification

npm run build passes. node scripts/verify-br-wbr.mjs exits 0 — <p>one<br>two</p> produces exactly two line fragments with Chrome-parity rects (layer-3 within tolerance), and <wbr> fixtures match Chrome's break decisions. Existing text corpora (spine wrapping, white-space, text-align) stay green. node scripts/check-charter.mjs exits 0.

## Prohibited Patterns

- Do not treat <br> as a block box or a replaced box — it is an inline forced-break that participates in line-box layout.
- Do not let <br> emit an empty atomic piece that steals a line or a width (it occupies no advance and forces the break at the current position).
- Do not drop <wbr> to a no-op — it must be an opportunity break point (width 0) that the breaker may use.
- Do not regress the pure-text Pretext-delegation fast path — <br>/<wbr> content must be routed through the piece walker that can express forced breaks.
- Do not change white-space handling semantics (pre/pre-line newlines) while adding forced breaks.
