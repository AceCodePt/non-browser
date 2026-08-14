# Text-Measure Ledger

Owning seam: the generic Canvas interface (`src/canvas/`) with the skia implementation (`src/canvas/skia.ts`); measurement consumers live in `src/layout/measure.ts` (`measureTextWidth`) and Pretext's measurement context (`src/pretext/`). Layer-1 corpus: `corpus/measure-corpus/`, `npm run verify:text-measure`.

## Scope

Per-string shaped advances resolved against the registered font set: the engine measures with the Canvas interface's `measureText` for a CSS font shorthand string, and the oracle measures the same string with a real Chrome `ctx.measureText` (Playwright) using the same registered font files (the engine registers the corpus faces via `registerFont`; Chrome resolves the same system-installed faces). Both ride Skia/HarfBuzz, so the layer-1 tolerance is sub-pixel.

## Latest Run

- Generated: 2026-08-14T17:43:18.791Z
- Strings measured: 89 (82 pass corpus + 7 documented known gaps)
- Pass rate (pass corpus): 100.0% (82/82 within tolerance)
- Mean delta (pass corpus): 0.0016px
- Worst delta (pass corpus): 0.0050px
- Worst delta (all strings, incl. gaps): 146.0025px
- Tolerance: mean ≤ 0.01px, no string > 0.5px (charter §2, tolerances.json v2)
- Categories: 8, all PASS

## Categories

| Category | Strings | Expected | Mean Δ px | Max Δ px | Result |
|---|---|---|---|---|---|
| cjk | 10 | pass | 0.0005 | 0.0050 | PASS |
| combining-marks | 8 | pass | 0.0019 | 0.0050 | PASS |
| emoji | 15 | pass | 0.0011 | 0.0039 | PASS |
| known-gaps | 7 | fail | 51.3759 | 146.0025 | PASS |
| latin | 21 | pass | 0.0019 | 0.0050 | PASS |
| letter-spacing | 8 | pass | 0.0026 | 0.0039 | PASS |
| rtl | 11 | pass | 0.0024 | 0.0041 | PASS |
| tabs | 9 | pass | 0.0008 | 0.0047 | PASS |

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
| emoji | 👨‍👩‍👧‍👦 | 16px 'Noto Sans' | 38.4000 | 38.4001 | 0.0001 | PASS |
| emoji | 👨‍👩‍👧‍👦 | 32px 'Noto Sans' | 76.8000 | 76.8002 | 0.0002 | PASS |
| emoji | 👨‍👩‍👧‍👦👨‍👩‍👧‍👦 | 16px 'Noto Sans' | 76.8000 | 76.8002 | 0.0002 | PASS |
| emoji | 👩‍👧 | 16px 'Noto Sans' | 19.2000 | 19.2000 | 0.0000 | PASS |
| emoji | 👩‍❤️‍💋‍👨 | 16px 'Noto Sans' | 38.4000 | 38.4001 | 0.0001 | PASS |
| emoji | 🇺🇸 | 16px 'Noto Sans' | 19.2000 | 19.2000 | 0.0000 | PASS |
| emoji | 🇺🇸 🇨🇳 🇯🇵 | 16px 'Noto Sans' | 65.9200 | 65.9201 | 0.0001 | PASS |
| emoji | 1️⃣ 2️⃣ 3️⃣ | 16px 'Noto Sans' | 64.5800 | 64.5761 | 0.0039 | PASS |
| emoji | 👍🏻 👍🏼 👍🏽 | 16px 'Noto Sans' | 65.9200 | 65.9201 | 0.0001 | PASS |
| emoji | 😀 | 16px 'DejaVu Sans' | 16.6800 | 16.6797 | 0.0003 | PASS |
| emoji | ✈️ ☕ ⚽ | 16px 'DejaVu Sans' | 47.5200 | 47.5234 | 0.0034 | PASS |
| emoji | → ⇒ ↗ ⬇ | 16px 'DejaVu Sans' | 68.8800 | 68.8828 | 0.0028 | PASS |
| emoji | © ® ™ € £ ¥ § ¶ | 16px 'DejaVu Sans' | 132.3200 | 132.3203 | 0.0003 | PASS |
| emoji | ❤️ 💙 💚 | 16px 'DejaVu Sans' | 42.7800 | 42.7813 | 0.0013 | PASS |
| emoji | ⭐ 🌟 ✨ | 16px 'DejaVu Sans' | 38.9800 | 38.9766 | 0.0034 | PASS |
| known-gaps | 😀 😃 😄 | 16px 'Noto Sans' | 37.1200 | 59.3200 | 22.2000 | GAP |
| known-gaps | "\t\t\t" | 16px 'Noto Sans' | 28.8000 | 12.4800 | 16.3200 | GAP |
| known-gaps | abc 中文 😀 def | 16px 'Noto Sans' | 92.1400 | 112.3441 | 20.2041 | GAP |
| known-gaps | English 中文 mixed text テスト | 16px 'Droid Sans Fallback' | 352.7500 | 209.6250 | 143.1250 | GAP |
| known-gaps | مرحبا! هل أنت بخير؟ | 16px 'Droid Arabic Kufi' | 140.4500 | 136.1719 | 4.2781 | GAP |
| known-gaps | สวัสดีชาวโลก ภาษาไทย | 16px 'Droid Sans Fallback' | 308.1900 | 162.1875 | 146.0025 | GAP |
| known-gaps | مرحبا | 16px 'Droid Arabic Kufi' ls=1.5 | 42.2200 | 34.7188 | 7.5013 | GAP |
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
| rtl | مرحبا بالعالم هذا نص عربي | 16px 'Droid Arabic Kufi' | 186.6300 | 186.6328 | 0.0028 | PASS |
| rtl | هذا نص عربي طويل لاختبار قياس عرض النص في متصفح كروم | 16px 'Droid Arabic Kufi' | 434.6600 | 434.6563 | 0.0038 | PASS |
| rtl | السلام عليكم ورحمة الله وبركاته | 16px 'Droid Arabic Kufi' | 225.9900 | 225.9922 | 0.0022 | PASS |
| rtl | بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ | 16px 'Droid Arabic Kufi' | 158.8200 | 158.8203 | 0.0003 | PASS |
| rtl | الأرقام العربية ٠١٢٣٤٥٦٧٨٩ | 16px 'Droid Arabic Kufi' | 179.6900 | 179.6875 | 0.0025 | PASS |
| rtl | رقم ٥ ورقم ٧ | 16px 'Droid Arabic Kufi' | 94.2100 | 94.2109 | 0.0009 | PASS |
| rtl | شَدَّة تَشْكِيل | 16px 'Droid Arabic Kufi' | 86.2200 | 86.2188 | 0.0013 | PASS |
| rtl | שלום עולם טקסט בעברית | 16px 'Droid Sans Hebrew' | 173.3700 | 173.3672 | 0.0028 | PASS |
| rtl | זהו טקסט עברי לבדיקת רוחב טקסט בדפדפן | 16px 'Droid Sans Hebrew' | 293.1200 | 293.1172 | 0.0028 | PASS |
| rtl | אבגדהוזחטיכלמנסעפצקרשת | 16px 'Droid Sans Hebrew' | 191.1900 | 191.1875 | 0.0025 | PASS |
| rtl | שָׁלוֹם עוֹלָם | 16px 'Droid Sans Hebrew' | 72.0900 | 72.0859 | 0.0041 | PASS |
| tabs | "\t" | 16px 'Source Code Pro' | 9.6000 | 9.6000 | 0.0000 | PASS |
| tabs | "\t\t\t" | 16px 'Source Code Pro' | 28.8000 | 28.8001 | 0.0001 | PASS |
| tabs | "a\tb\tc\td" | 16px 'Source Code Pro' | 67.2000 | 67.2001 | 0.0002 | PASS |
| tabs | "a\tbb\tccc" | 16px 'Source Code Pro' | 76.8000 | 76.8002 | 0.0002 | PASS |
| tabs | "tab\ttext\texample" | 16px 'Source Code Pro' | 153.6000 | 153.6003 | 0.0003 | PASS |
| tabs | "\t" | 16px 'Liberation Mono' | 9.6000 | 9.6016 | 0.0016 | PASS |
| tabs | "\t\t\t" | 16px 'Liberation Mono' | 28.8000 | 28.8047 | 0.0047 | PASS |
| tabs | "a\tbb\tccc\tdddd" | 16px 'Liberation Mono' | 124.8200 | 124.8203 | 0.0003 | PASS |
| tabs | "a\tb\tc" | 24px 'Source Code Pro' | 72.0000 | 71.9998 | 0.0002 | PASS |

## Failing Fonts

Fonts whose strings exceeded tolerance this run: Noto Sans, Droid Sans Fallback, Droid Arabic Kufi.

All of them are covered by documented known gaps (see below); an unexpected failure here fails the run.

## Known Gaps (Documented Divergences)

Failures are permitted only for the following documented divergences; the verify script asserts each still diverges so a closed gap must be reclassified into the pass corpus.

- **😀 😃 😄** @ 16px 'Noto Sans' — Δ 22.2000px: No emoji font is installed system-wide; Chrome falls back to an emoji-capable face for U+1F600-range smileys while skia's GlobalFonts keeps the missing glyph in Noto Sans. ZWJ sequences, flags, and keycaps measure identically (see emoji/), but plain smileys diverge.
- **"\t\t\t"** @ 16px 'Noto Sans' — Δ 16.3200px: Proportional-font tabs: Chrome's canvas applies tab-stop semantics (a tab advances to the next tab stop) while skia returns the font's raw U+0009 advance. Monospace tabs agree (see tabs/); this is the proportional-font tab case.
- **abc 中文 😀 def** @ 16px 'Noto Sans' — Δ 20.2041px: Mixed-script string: Chrome resolves each missing glyph through its per-glyph fallback (CJK and emoji faces), while skia keeps the whole run in Noto Sans. Single-script strings in one font agree (see cjk/, rtl/); mixed runs diverge.
- **English 中文 mixed text テスト** @ 16px 'Droid Sans Fallback' — Δ 143.1250px: Mixed-script fallback: Chrome shapes Latin and Japanese through fallback faces rather than the registered CJK face; skia keeps the run in Droid Sans Fallback.
- **مرحبا! هل أنت بخير؟** @ 16px 'Droid Arabic Kufi' — Δ 4.2781px: Latin punctuation (!) in an Arabic run: Chrome falls the ASCII glyph back to a Latin face while skia keeps it in Droid Arabic Kufi. Pure-script Arabic and Arabic-Indic digits agree (see rtl/).
- **สวัสดีชาวโลก ภาษาไทย** @ 16px 'Droid Sans Fallback' — Δ 146.0025px: Thai glyphs: the registered set has no Thai face, so skia's fallback and Chrome's fontconfig fallback resolve the run to different fonts and widths.
- **مرحبا** @ 16px 'Droid Arabic Kufi', ls 1.5 — Δ 7.5013px: Letter-spacing on a joining script: Chrome does not apply ctx.letterSpacing to Arabic, while the engine's letter-spacing model adds spacing after every codepoint. Latin and CJK letter-spacing agree (see letter-spacing/).

## Coverage

- **Latin** (`latin/`): Noto Sans at 10–48px, uppercase/lowercase, digits, ligatures, kerning, punctuation, nbsp; bold/semibold/italic via font shorthand; Liberation Sans/Serif/Mono, DejaVu Sans, Source Code Pro.
- **CJK** (`cjk/`): Simplified Chinese and Japanese (kanji/kana) on Droid Sans Fallback / Droid Sans Japanese, incl. CJK punctuation.
- **RTL** (`rtl/`): Arabic (harakat, Arabic-Indic digits) on Droid Arabic Kufi; Hebrew (niqqud) on Droid Sans Hebrew.
- **Emoji** (`emoji/`): ZWJ family/kiss, flags, keycaps, skin tones on Noto Sans; dingbats, arrows, symbols on DejaVu Sans.
- **Combining marks** (`combining-marks/`): decomposed/precomposed/double Latin diacritics on Noto Sans; Devanagari conjuncts, matras, digits on Droid Sans Devanagari.
- **Tab runs** (`tabs/`): tabs on monospace faces (Source Code Pro, Liberation Mono).
- **Letter-spaced** (`letter-spacing/`): positive, fractional, negative spacing on Latin and CJK.
