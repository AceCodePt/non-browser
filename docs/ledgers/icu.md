# ICU Ledger

Runtime pin record per the charter §6: every segmentation verification run records the ICU versions in play so segmentation parity with the browser's ICU can be tracked. Owning seam: `src/pretext/` (`segmentGraphemes`, Pretext prepare/layout via `Intl.Segmenter`); corpus: `corpus/segmenter-icu/`; `npm run verify:segmenter`.

## Current pin

| Component | Version |
| --- | --- |
| `process.versions.icu` (Node) | 78.3 |
| Node | 26.7.0 |
| Chrome (Playwright oracle) | 151.0.7922.34 |
| Chrome ICU data (icudtl.dat UDataInfo) | CmnD format v1.0.0.0, data v3.0.0.0 |
| Chrome ICU library | 78.2 (chromium deps/icu @ d578f2e8…, `U_ICU_VERSION`) |

`Intl.Segmenter` is required by the charter; `scripts/check-charter.mjs` and `scripts/verify-segmenter.mjs` fail fast when it is missing or ICU data is small (fewer than all corpus locales supported). Pretext segments text (grapheme granularity) via `Intl.Segmenter`; segmentation parity with Chrome is proven by the segmenter corpus and the Pretext layout() check below.

## Latest Run

- Generated: 2026-08-18T08:41:04.762Z
- Node ICU `78.3` vs Chrome 151.0.7922.34 ICU: **parity**
- Strings segmented: 72 (72 pass corpus + 0 documented gaps)
- Grapheme clusters: 182 (up to 13 in one string)
- Grapheme boundary parity (pass corpus): 72/72
- Pretext layout() parity (pass corpus): 72/72
- Categories: 6, all PASS

## Corpus

| Category | Strings | Grapheme parity | Pretext layout() parity | Result |
|---|---|---|---|---|
| around-spaces | 12 | PASS | PASS | PASS |
| combining-marks | 11 | PASS | PASS | PASS |
| flags | 7 | PASS | PASS | PASS |
| indic-conjuncts | 16 | PASS | PASS | PASS |
| skin-tones | 12 | PASS | PASS | PASS |
| zwj-emoji | 14 | PASS | PASS | PASS |

## Per-String Results

| Category | String | Graphemes | Result |
|---|---|---|---|
| around-spaces | hello 👨‍👩‍👧‍👦 world | 13 | PASS |
| around-spaces | 🇺🇸 usa 🇯🇵 | 7 | PASS |
| around-spaces | नमस्ते दुनिया | 7 | PASS |
| around-spaces | à b̀ | 3 | PASS |
| around-spaces | 👍🏻 ok 👍🏽 | 6 | PASS |
| around-spaces | héllo wörld | 11 | PASS |
| around-spaces | word  é́  word | 13 | PASS |
| around-spaces | 👨‍👩‍👧‍👦x | 2 | PASS |
| around-spaces | x👨‍👩‍👧‍👦y | 3 | PASS |
| around-spaces | ä  b̈ | 4 | PASS |
| around-spaces | क्ष त्र | 3 | PASS |
| around-spaces | 👨‍👩‍👧‍👦 ok | 4 | PASS |
| combining-marks | ẹ́ | 1 | PASS |
| combining-marks | ä́ | 1 | PASS |
| combining-marks | ế | 1 | PASS |
| combining-marks | à b̀ | 3 | PASS |
| combining-marks | é | 1 | PASS |
| combining-marks | é | 1 | PASS |
| combining-marks | ạ̈́ | 1 | PASS |
| combining-marks | कि | 1 | PASS |
| combining-marks | अं | 1 | PASS |
| combining-marks | ṭ̂ | 1 | PASS |
| combining-marks | ȫ | 1 | PASS |
| flags | 🇺🇸 🇨🇳 🇯🇵 🇩🇪 | 7 | PASS |
| flags | 🇺🇸🇨🇳 | 2 | PASS |
| flags | 🇺🇳 | 1 | PASS |
| flags | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 | 1 | PASS |
| flags | 🏴󠁧󠁢󠁳󠁣󠁴󠁿 | 1 | PASS |
| flags | 🇺🇸 🇨🇳 🇯🇵 🇩🇪 🇧🇷 🇮🇳 | 11 | PASS |
| flags | 🇪🇺 | 1 | PASS |
| indic-conjuncts | क्ष | 1 | PASS |
| indic-conjuncts | त्र | 1 | PASS |
| indic-conjuncts | ज्ञ | 1 | PASS |
| indic-conjuncts | श्र | 1 | PASS |
| indic-conjuncts | জ্ঞ | 1 | PASS |
| indic-conjuncts | க்ஷ | 2 | PASS |
| indic-conjuncts | ക്ഷ | 1 | PASS |
| indic-conjuncts | క్ష | 1 | PASS |
| indic-conjuncts | द्द | 1 | PASS |
| indic-conjuncts | क्क | 1 | PASS |
| indic-conjuncts | श्री | 1 | PASS |
| indic-conjuncts | नमस्ते दुनिया | 7 | PASS |
| indic-conjuncts | हिन्दी | 2 | PASS |
| indic-conjuncts | संस्कृतम् | 4 | PASS |
| indic-conjuncts | क्षितिज | 3 | PASS |
| indic-conjuncts | दुर्गा | 2 | PASS |
| skin-tones | 👍🏻 👍🏼 👍🏽 👍🏾 👍🏿 | 9 | PASS |
| skin-tones | 👍🏻 | 1 | PASS |
| skin-tones | 👍🏿 | 1 | PASS |
| skin-tones | 👋🏽 | 1 | PASS |
| skin-tones | ✋🏻 | 1 | PASS |
| skin-tones | 🙋🏽‍♀️ | 1 | PASS |
| skin-tones | 👨🏿‍💻 | 1 | PASS |
| skin-tones | 🧑🏽‍🤝‍🧑🏼 | 1 | PASS |
| skin-tones | 🏃🏽‍♀️ | 1 | PASS |
| skin-tones | 👮🏽 | 1 | PASS |
| skin-tones | 💁🏿‍♀️ | 1 | PASS |
| skin-tones | 👍🏻 👍🏼 👍🏽 | 5 | PASS |
| zwj-emoji | 👨‍👩‍👧‍👦 | 1 | PASS |
| zwj-emoji | 👩‍👧‍👦 | 1 | PASS |
| zwj-emoji | 👨‍❤️‍👨 | 1 | PASS |
| zwj-emoji | 👩‍❤️‍💋‍👨 | 1 | PASS |
| zwj-emoji | 🧑‍🤝‍🧑 | 1 | PASS |
| zwj-emoji | 👨‍👩‍👧 | 1 | PASS |
| zwj-emoji | 👨‍👨‍👦‍👦 | 1 | PASS |
| zwj-emoji | 👩‍👩‍👧‍👧 | 1 | PASS |
| zwj-emoji | 🏃‍♂️ | 1 | PASS |
| zwj-emoji | 👩‍⚕️ | 1 | PASS |
| zwj-emoji | 🧑‍🚀 | 1 | PASS |
| zwj-emoji | 👨‍👩 | 1 | PASS |
| zwj-emoji | 👨‍👩‍👧‍👦👨‍👩‍👧‍👦 | 2 | PASS |
| zwj-emoji | 👩‍❤️‍👨 | 1 | PASS |

## Divergences

None recorded for this run — every corpus string segmented identically (Node ICU vs Chrome ICU) and laid out identically through Pretext. The typed gap-declaration fixture mechanism (expected.<layer> = { result: "fail", reason, sunset }) is the place to record Chrome-vs-Node ICU divergences in segmentation behavior when the corpus grows past the current strings.
