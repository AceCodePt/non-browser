# Code Review — cascade-core (2026-08-17, code-focused rewrite)

Reviewer's note: rewritten per the owner's request to stick to the code. Every
claim below was verified by direct reading of the cited lines. The earlier
version of this file contained claims that direct reading refuted; those are
recorded in the "Corrected" section so the record is straight.

## What the code does well

- The parity seam is real: oracle values are harvested fresh from headless
  Chrome on every run and diffed against the engine. Layers 1–3 are strict.
- Where the code mirrors Chrome internals, it does so with named ports and the
  source cited (`paint.ts` `Color::Light/Dark/BlendWithWhite`, the flexbox
  baseline authority). The constants are Blink's, not invented.
- `src/layout/types.ts:10–11` shows layering is an explicit concern: "Lives
  here (not in the harness) so the renderer never depends on the test harness."

## Confirmed problems (severity-ordered)

### 1. Copy-paste that has already drifted into a behavioral divergence

The flex and grid modules carry near-verbatim copies of the inline-content
sizing helpers — and the copies disagree:

- `flexbox.ts:133` `contentInlineSizes` measures with
  `measureTextWidth(w, size, family, style.letterSpacing)` (letter-spacing
  included).
- `grid.ts:89` `contentInlineSizes` measures with
  `measureTextWidth(w, size, family)` — **no letter-spacing**.

Same text, same CSS, two different min/max content widths depending on whether
the container is `display:flex` or `display:grid`. This is the exact bug class
duplication breeds, and it is already present.
- `hasInlineText` (`flexbox.ts:106` / `grid.ts:62`) and `collectInlineText`
  (`flexbox.ts:119` / `grid.ts:75`) are byte-identical except that flexbox also
  skips `display:flex` children — the one word that will quietly diverge next.

### 2. Byte-identical duplicate comparator

`compareNum` (`cascade/media.ts:223`) and `compare`
(`cascade/phases/media-queries.ts:111`) are the same seven-case switch over
`eq/min/max/lt/gt/lte/gte`. Two copies of media-op evaluation in two phases of
the same subsystem.

### 3. Dead API surface and dead code

- `grid.ts:116` `inlineContributions` returns `{ min, max, minimum }`; grep
  shows **zero readers** of `.minimum`. A third return field that no caller
  uses invites a future caller to trust it.
- `block-inline.ts:1012` `void padBorderH;` — computes
  `borderPaddingInline(...)` at :759 then discards it.
- `css.ts:532` `if (s === '0') return { px: 0, ... }` is unreachable: `'0'` is
  already matched by the length regex at :506, whose `default` case returns the
  same object.

### 4. Monolithic functions and modules

- `block-inline.ts` is 2438 lines carrying at least five responsibilities:
  block layout, float layout, list markers/counter text, shadow/border paint-op
  building, and the piece-based inline text engine (`buildPieces`/`walkLine`/
  `pushTextPieces`/`layoutInlineContent`, :1734–:2438).
- `makeStyle` (`css.ts:1159`) runs to the end of the 1820-line file — ~660
  lines of computed-value assembly in one function.

### 5. Two line-fill implementations inside `measure.ts` alone

`layoutTextLines` (:173) is the shipped block wrapper. It dispatches to either
`pretextWordFill` (:332) or `fillWordLines` (:397) — two greedy/segment fill
loops, the seam-vs-fallback split. That is the genuinely duplicated piece: two
line-fill engines in one 455-line file, selected by a knob.

### 6. Runtime import cycle between cascade and layout

- `layout/block-inline.ts:26–27` imports `resolveUaDecls` from
  `cascade/ua.js` and `PseudoDecls` from `cascade/phases/media-queries.js`.
- `cascade/stylesheet.ts:15–16` imports `parseDeclarationBlock` from
  `layout/css.js` (a value import, not a type import).
- `cascade/ua.ts:19–20` imports types from `layout/`.

Some edges are `import type` (harmless), but `parseDeclarationBlock` and
`resolveUaDecls` are runtime value imports — the claimed pipeline
(parse → cascade → layout) is not reflected in the import graph.

## Corrected — claims in the earlier version that direct reading refuted

| Earlier claim | Reality |
| --- | --- |
| `Box` imported from `../harness/fixtures` (renderer depends on test harness) | `Box` is defined in `src/layout/types.ts:12`; no harness imports exist outside `src/harness/`. The claim was false. |
| `breakNextLine`/`prepareText` import in `measure.ts:16` unused | Both are called at `measure.ts:348` and `:354` in `pretextWordFill`. |
| `usePretextBreaker` knob "written but never read" | Called from `verify-four-layer.mjs:219`, `verify-breaker.mjs:219–232`, `bench-engine-vs-oracle.mjs:37–93`. |
| `paint.ts` alpha table `[153,170,187,204]` is unexplained magic | A named port of Blink's `Color` blending with the source in the names/comments. |
| "Two parallel text engines kept parity by hand" | `layoutInlineContent` delegates pure text to the flat path (`block-inline.ts:2110–2115`); one authority, not two rivals. |

## Bottom line

The code's structural risk is duplication, not cleverness: flex/grid helpers are
copied and have already drifted (`letter-spacing`), media-op evaluation exists
twice byte-for-byte, and a dead `minimum` field sits in a public return shape.
The monoliths (`block-inline.ts`, `makeStyle`) concentrate the risk. The good
news is the behavior is anchored by a live-Chrome oracle on every run — so the
drift is latent, but the fix is factoring, not proof.
