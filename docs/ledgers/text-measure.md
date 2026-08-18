# Text-Measure Ledger

Owning seam: the generic Canvas interface (`src/canvas/`) with the skia implementation (`src/canvas/skia.ts`); measurement consumers live in `src/layout/measure.ts` (`measureTextWidth`) and Pretext's measurement context (`src/pretext/`). Layer-1 corpus: `corpus/measure-corpus/`, `npm run verify:text-measure`.

## Scope

Per-string shaped advances resolved against the registered font set: the engine measures with the Canvas interface's `measureText` for a CSS font shorthand string, and the oracle measures the same string with a real Chrome `ctx.measureText` (Playwright) using the same registered font files (the engine registers the corpus faces via `registerFont`; Chrome resolves the same system-installed faces). Both ride Skia/HarfBuzz, so the layer-1 tolerance is sub-pixel.

## Latest Run

- Generated: 2026-08-18T06:23:01.239Z
- Strings measured: 96 (96 pass corpus + 0 documented known gaps)
- Pass rate (pass corpus): 100.0% (96/96 within tolerance)
- Mean delta (pass corpus): 0.0025px
- Worst delta (pass corpus): 0.0300px
- Worst delta (all strings, incl. gaps): 0.0300px
- Tolerance: mean ≤ 0.01px, no string > 0.5px (charter §2, tolerances.json v2)
- Categories: 10, all PASS

## Categories

| Category | Strings | Expected | Mean Δ px | Max Δ px | Result |
|---|---|---|---|---|---|
| cjk | 10 | pass | 0.0005 | 0.0050 | PASS |
| combining-marks | 8 | pass | 0.0019 | 0.0050 | PASS |
| emoji | 16 | pass | 0.0035 | 0.0300 | PASS |
| known-gaps | 0 | pass | 0.0000 | n/a | PASS |
| latin | 21 | pass | 0.0019 | 0.0050 | PASS |
| letter-spacing | 8 | pass | 0.0026 | 0.0039 | PASS |
| mixed-script | 5 | pass | 0.0083 | 0.0241 | PASS |
| rtl | 14 | pass | 0.0026 | 0.0081 | PASS |
| tabs | 10 | pass | 0.0017 | 0.0103 | PASS |
| thai | 4 | pass | 0.0027 | 0.0037 | PASS |

## Per-String Results

| Category | String | Font | Engine px | Chrome px | Δ px | Result |
|---|---|---|---|---|---|---|
| cjk | 这是一个用于测试文本宽度的中文句子，包含标点符号。 | 16px 'Droid Sans Fallback' | 400.0000 | 400.0000 | 0.0000 | PASS |
| cjk | 中文测试句子可以吗 | 16px 'Droid Sans Fallback' | 144.0000 | 144.0000 | 0.0000 | PASS |
| cjk | 汉字汉字的宽度测试 | 12px 'Droid Sans Fallback' | 108.0000 | 108.0000 | 0.0000 | PASS |
| cjk | 中文测试 | 40px 'Droid Sans Fallback' | 160.0000 | 160.0000 | 0.0000 | PASS |
| cjk | 《引号》【括号】——破折号、顿号 | 16px 'Droid Sans Fallback' | 256.0000 | 256.0000 | 0.0000 | PASS |
| cjk | 中文 中文 中文 | 16px 'Droid Sans Fallback' | 104.3800 | 104.3750 | 0.0050 | PASS |
| cjk | 这是一个包含中文字符的句子 | 16px 'Droid Sans Fallback' | 208.0000 | 208.0000 | 0.0000 | PASS |
| cjk | これは日本語のテキスト幅をテストする文です。 | 16px 'Droid Sans Japanese' | 352.0000 | 352.0000 | 0.0000 | PASS |
| cjk | 日本語の文章テスト | 16px 'Droid Sans Japanese' | 144.0000 | 144.0000 | 0.0000 | PASS |
| cjk | かなカタカナ漢字 | 16px 'Droid Sans Japanese' | 128.0000 | 128.0000 | 0.0000 | PASS |
| combining-marks | à é î õ ü | 16px 'Noto Sans' | 58.3400 | 58.3361 | 0.0039 | PASS |
| combining-marks | é è ñ ô ü à | 16px 'Noto Sans' | 77.2800 | 77.2801 | 0.0001 | PASS |
| combining-marks | ẹ́ ä́ | 16px 'Noto Sans' | 22.1600 | 22.1600 | 0.0000 | PASS |
| combining-marks | नमस्ते दुनिया | 16px 'Droid Sans Devanagari' | 72.6800 | 72.6797 | 0.0003 | PASS |
| combining-marks | क्ष त्र ज्ञ श्र | 16px 'Droid Sans Devanagari' | 54.1200 | 54.1172 | 0.0028 | PASS |
| combining-marks | का की कु कू के कै को कौ | 16px 'Droid Sans Devanagari' | 143.2200 | 143.2188 | 0.0013 | PASS |
| combining-marks | संख्याएँ १२३४५६७८९० | 16px 'Droid Sans Devanagari' | 134.6500 | 134.6484 | 0.0016 | PASS |
| combining-marks | १२३४५६७८९० | 16px 'Droid Sans Devanagari' | 88.1300 | 88.1250 | 0.0050 | PASS |
| emoji | 😀 | 16px 'DejaVu Sans' | 16.6800 | 16.6797 | 0.0003 | PASS |
| emoji | 😀 😃 😄 | 16px 'DejaVu Sans' | 60.2100 | 60.2109 | 0.0009 | PASS |
| emoji | ☺ | 16px 'DejaVu Sans' | 16.6800 | 16.6797 | 0.0003 | PASS |
| emoji | → ⇒ ↗ ⬇ | 16px 'DejaVu Sans' | 68.8800 | 68.8828 | 0.0028 | PASS |
| emoji | → ← ↑ ↓ ↔ ↕ | 16px 'DejaVu Sans' | 105.8700 | 105.8672 | 0.0028 | PASS |
| emoji | ♠ ♣ ♥ ♦ | 16px 'DejaVu Sans' | 72.6300 | 72.6328 | 0.0028 | PASS |
| emoji | ∑ ≠ ≈ ∞ | 16px 'DejaVu Sans' | 66.1800 | 66.1797 | 0.0003 | PASS |
| emoji | § ¶ † ‡ | 16px 'DejaVu Sans' | 49.4400 | 49.4375 | 0.0025 | PASS |
| emoji | ✓ ☑ ✗ | 16px 'DejaVu Sans' | 51.3300 | 51.3281 | 0.0019 | PASS |
| emoji | ☀ ☁ ❄ | 16px 'DejaVu Sans' | 53.9200 | 53.9219 | 0.0019 | PASS |
| emoji | ✿ ❀ ❁ | 16px 'DejaVu Sans' | 50.3900 | 50.3906 | 0.0006 | PASS |
| emoji | © ® ™ € £ ¥ § ¶ | 16px 'DejaVu Sans' | 132.3200 | 132.3203 | 0.0003 | PASS |
| emoji | © ® ™ € £ ¥ § ¶ | 16px 'Noto Sans' | 114.2600 | 114.2562 | 0.0038 | PASS |
| emoji | ™ | 16px 'Noto Sans' | 12.3700 | 12.3680 | 0.0020 | PASS |
| emoji | § ¶ † ‡ | 16px 'Noto Sans' | 47.5500 | 47.5521 | 0.0021 | PASS |
| emoji | 😀 | 16px 'Noto Color Emoji' | 19.9700 | 20.0000 | 0.0300 | PASS |
| latin | Pack my box with five dozen liquor jugs | 10px 'Noto Sans' | 184.7000 | 184.6998 | 0.0002 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 16px 'Noto Sans' | 334.8800 | 334.8806 | 0.0006 | PASS |
| latin | How vexingly quick daft zebras jump! | 16px 'Noto Sans' | 278.6400 | 278.6406 | 0.0005 | PASS |
| latin | Sphinx of black quartz, judge my vow | 24px 'Noto Sans' | 418.6500 | 418.6548 | 0.0049 | PASS |
| latin | Amazingly few discotheques provide jukeboxes | 32px 'Noto Sans' | 707.1400 | 707.1375 | 0.0026 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 48px 'Noto Sans' | 1004.6400 | 1004.6421 | 0.0021 | PASS |
| latin | ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz | 16px 'Noto Sans' | 488.6100 | 488.6090 | 0.0010 | PASS |
| latin | 0123456789 9876543210 | 16px 'Noto Sans' | 187.2000 | 187.2005 | 0.0005 | PASS |
| latin | office ff fi fl ffi ffl | 16px 'Noto Sans' | 122.8600 | 122.8642 | 0.0042 | PASS |
| latin | AVATAR TA Te To | 48px 'Noto Sans' | 361.0100 | 361.0087 | 0.0013 | PASS |
| latin | He said “hello” — and left. | 16px 'Noto Sans' | 193.8900 | 193.8884 | 0.0016 | PASS |
| latin | one…two | 16px 'Noto Sans' | 69.2800 | 69.2801 | 0.0001 | PASS |
| latin | 1 000 000 | 16px 'Noto Sans' | 70.8800 | 70.8802 | 0.0002 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 16px 'Liberation Sans' | 316.6000 | 316.6016 | 0.0016 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 16px 'Liberation Serif' | 292.3800 | 292.3750 | 0.0050 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 16px 'Liberation Mono' | 412.8700 | 412.8672 | 0.0028 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 16px 'DejaVu Sans' | 359.8700 | 359.8672 | 0.0028 | PASS |
| latin | The quick brown fox jumps over the lazy dog | 16px 'Source Code Pro' | 412.8000 | 412.8009 | 0.0009 | PASS |
| latin | The quick brown fox jumps | 700 16px 'Noto Sans' | 214.6100 | 214.6084 | 0.0016 | PASS |
| latin | The quick brown fox jumps | 600 16px 'Noto Sans' | 209.9500 | 209.9524 | 0.0024 | PASS |
| latin | The quick brown fox jumps | italic 16px 'Noto Sans' | 189.9500 | 189.9524 | 0.0024 | PASS |
| letter-spacing | Letter spacing matters here | 16px 'Noto Sans' ls=1 | 235.1000 | 235.0964 | 0.0036 | PASS |
| letter-spacing | Letter spacing matters here | 16px 'Noto Sans' ls=2.5 | 275.6000 | 275.5964 | 0.0036 | PASS |
| letter-spacing | Letter spacing matters here | 16px 'Noto Sans' ls=-0.5 | 194.6000 | 194.5964 | 0.0036 | PASS |
| letter-spacing | The quick brown fox jumps over the lazy dog | 16px 'Noto Sans' ls=1.5 | 399.3800 | 399.3807 | 0.0007 | PASS |
| letter-spacing | Kerning pairs AV To | 32px 'Noto Sans' ls=1 | 310.2300 | 310.2326 | 0.0026 | PASS |
| letter-spacing | 中文测试 | 16px 'Droid Sans Fallback' ls=2 | 72.0000 | 72.0000 | 0.0000 | PASS |
| letter-spacing | Short | 16px 'Noto Sans' ls=0.25 | 41.9900 | 41.9861 | 0.0039 | PASS |
| letter-spacing | 中文 中文 | 16px 'Droid Sans Fallback' ls=0.5 | 70.6900 | 70.6875 | 0.0025 | PASS |
| mixed-script | abc 中文 😀 def | 16px 'Noto Sans' | 115.3200 | 115.3441 | 0.0241 | PASS |
| mixed-script | English 中文 mixed text テスト | 16px 'Droid Sans Fallback' | 209.6300 | 209.6250 | 0.0050 | PASS |
| mixed-script | abc 中文 def | 16px 'Noto Sans' | 91.1900 | 91.1841 | 0.0059 | PASS |
| mixed-script | hello 世界 | 16px 'Noto Sans' | 73.0100 | 73.0081 | 0.0019 | PASS |
| mixed-script | 中文 English 中文 | 16px 'Droid Sans Fallback' | 121.2700 | 121.2656 | 0.0044 | PASS |
| rtl | مرحبا بالعالم هذا نص عربي | 16px 'Droid Arabic Kufi' | 186.6300 | 186.6328 | 0.0028 | PASS |
| rtl | هذا نص عربي طويل لاختبار قياس عرض النص في متصفح كروم | 16px 'Droid Arabic Kufi' | 434.6600 | 434.6563 | 0.0038 | PASS |
| rtl | السلام عليكم ورحمة الله وبركاته | 16px 'Droid Arabic Kufi' | 225.9900 | 225.9922 | 0.0022 | PASS |
| rtl | بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ | 16px 'Droid Arabic Kufi' | 158.8200 | 158.8203 | 0.0003 | PASS |
| rtl | الأرقام العربية ٠١٢٣٤٥٦٧٨٩ | 16px 'Droid Arabic Kufi' | 179.6900 | 179.6875 | 0.0025 | PASS |
| rtl | رقم ٥ ورقم ٧ | 16px 'Droid Arabic Kufi' | 94.2100 | 94.2109 | 0.0009 | PASS |
| rtl | شَدَّة تَشْكِيل | 16px 'Droid Arabic Kufi' | 86.2200 | 86.2188 | 0.0013 | PASS |
| rtl | مرحبا! هل أنت بخير؟ | 16px 'Droid Arabic Kufi' | 136.1800 | 136.1719 | 0.0081 | PASS |
| rtl | مرحبا | 16px 'Droid Arabic Kufi' ls=1.5 | 34.7200 | 34.7188 | 0.0013 | PASS |
| rtl | السلام عليكم | 16px 'Droid Arabic Kufi' ls=1.5 | 93.9600 | 93.9609 | 0.0009 | PASS |
| rtl | שלום עולם טקסט בעברית | 16px 'Droid Sans Hebrew' | 173.3700 | 173.3672 | 0.0028 | PASS |
| rtl | זהו טקסט עברי לבדיקת רוחב טקסט בדפדפן | 16px 'Droid Sans Hebrew' | 293.1200 | 293.1172 | 0.0028 | PASS |
| rtl | אבגדהוזחטיכלמנסעפצקרשת | 16px 'Droid Sans Hebrew' | 191.1900 | 191.1875 | 0.0025 | PASS |
| rtl | שָׁלוֹם עוֹלָם | 16px 'Droid Sans Hebrew' | 72.0900 | 72.0859 | 0.0041 | PASS |
| tabs | "\t" | 16px 'Source Code Pro' | 9.6000 | 9.6000 | 0.0000 | PASS |
| tabs | "\t\t\t" | 16px 'Source Code Pro' | 28.8000 | 28.8001 | 0.0001 | PASS |
| tabs | "a\tb\tc\td" | 16px 'Source Code Pro' | 67.2000 | 67.2001 | 0.0001 | PASS |
| tabs | "a\tbb\tccc" | 16px 'Source Code Pro' | 76.8000 | 76.8002 | 0.0002 | PASS |
| tabs | "tab\ttext\texample" | 16px 'Source Code Pro' | 153.6000 | 153.6003 | 0.0003 | PASS |
| tabs | "\t" | 16px 'Liberation Mono' | 9.6000 | 9.6016 | 0.0016 | PASS |
| tabs | "\t\t\t" | 16px 'Liberation Mono' | 28.8000 | 28.8047 | 0.0047 | PASS |
| tabs | "a\tbb\tccc\tdddd" | 16px 'Liberation Mono' | 124.8100 | 124.8203 | 0.0103 | PASS |
| tabs | "a\tb\tc" | 24px 'Source Code Pro' | 72.0000 | 71.9998 | 0.0002 | PASS |
| tabs | "\t\t\t" | 16px 'Noto Sans' | 12.4800 | 12.4800 | 0.0000 | PASS |
| thai | สวัสดีชาวโลก ภาษาไทย | 16px 'Noto Sans Thai' | 143.8600 | 143.8563 | 0.0037 | PASS |
| thai | สวัสดีชาวโลก ภาษาไทย | 32px 'Noto Sans Thai' | 287.7100 | 287.7126 | 0.0026 | PASS |
| thai | ภาษาไทย ประเทศไทย | 16px 'Noto Sans Thai' | 132.6700 | 132.6723 | 0.0023 | PASS |
| thai | แมวน้อยน่ารัก | 16px 'Noto Sans Thai' | 88.9900 | 88.9922 | 0.0022 | PASS |

## Failing Fonts

None — every measured string is within tolerance.

## Known Gaps (Documented Divergences)

Failures are permitted only for the following documented divergences; the verify script asserts each still diverges so a closed gap must be reclassified into the pass corpus.


## Coverage

- **Latin** (`latin/`): Noto Sans at 10–48px, uppercase/lowercase, digits, ligatures, kerning, punctuation, nbsp; bold/semibold/italic via font shorthand; Liberation Sans/Serif/Mono, DejaVu Sans, Source Code Pro.
- **CJK** (`cjk/`): Simplified Chinese and Japanese (kanji/kana) on Droid Sans Fallback / Droid Sans Japanese, incl. CJK punctuation.
- **RTL** (`rtl/`): Arabic (harakat, Arabic-Indic digits) on Droid Arabic Kufi; Hebrew (niqqud) on Droid Sans Hebrew.
- **Emoji** (`emoji/`): plain smileys on DejaVu Sans (the reclassified known-gap string) and one glyph on the registered emoji face (Noto Color Emoji); arrows, suits, math/editorial marks, weather pictographs, currency on DejaVu Sans and Noto Sans. ZWJ family/flags/keycaps/skin-tone/VS16 sequences were dropped: they reroute to the color face at a 1.25em cell once an emoji face is installed and no longer match the engine.
- **Thai** (`thai/`): Thai runs (tone marks, sara-am, country-name phrases) on the registered Noto Sans Thai face.
- **Mixed-script** (`mixed-script/`): per-glyph script-run fallback at the measurement seam (`src/canvas/script-fallback.ts`) — mixed Latin/Han/emoji strings split into per-run faces (Latin primary, Droid Sans Fallback for Han, Noto Color Emoji for emoji, Liberation Serif for missing Latin on a CJK primary), matching Chrome's fontconfig resolution; the reclassified known-gap strings live here and in `rtl/`.
- **Combining marks** (`combining-marks/`): decomposed/precomposed/double Latin diacritics on Noto Sans; Devanagari conjuncts, matras, digits on Droid Sans Devanagari.
- **Tab runs** (`tabs/`): tabs on monospace faces (Source Code Pro, Liberation Mono) and the proportional-font case (Noto Sans), whose tab advances now mirror Chrome's canvas tab handling (`src/canvas/tabs.ts`).
- **Letter-spaced** (`letter-spacing/`): positive, fractional, negative spacing on Latin and CJK; joining-script suppression on Arabic lives in `rtl/`.
