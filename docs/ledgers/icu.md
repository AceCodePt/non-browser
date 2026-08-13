# ICU Ledger

Runtime pin record per the charter §6: every segmentation/measurement
verification run records the ICU versions in play so segmentation parity with
the browser's ICU can be tracked.

## Current pin

| Component | Version |
| --- | --- |
| `process.versions.icu` (Node) | 78.3 |
| Node | 26.7.0 |
| Chrome (Playwright oracle) | recorded in the per-run report (`docs/reports/`) |

`Intl.Segmenter` is required by the charter; `scripts/check-charter.mjs` fails
fast when it is missing or ICU data is incomplete. Pretext segments text
(grapheme granularity) via `Intl.Segmenter`; segmentation parity with Chrome is
exercised by the four-layer corpus and the line-breaker work owned by the
text-breaker-parity task.

## Divergences

None recorded. This ledger is the place to record Chrome-vs-Node ICU
divergences in segmentation behavior when the segmenter corpus grows past the
current Latin fixtures.
