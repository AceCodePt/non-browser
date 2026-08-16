/**
 * Where Chrome applies `letter-spacing` on the engine's single-face model.
 *
 * The engine's used width grows by `letterSpacing * positions`, where
 * `positions` is the count of characters after which Blink actually adds
 * spacing. CSS Text 4 §8.2.1 suppresses letter-spacing between cursive-script
 * characters but still spaces word separators (spaces) within cursive runs;
 * Blink decides per shaping run (shape_result.cc `IsCursiveScript`), and the
 * engine approximates that run membership from the character's own script
 * set. A Common punctuation between two Arabic letters is shaped inside the
 * Arabic run, so it gets no spacing either; a Latin letter or digit between
 * them is its own non-cursive run and keeps its spacing.
 */

const ARABIC = /\p{Script_Extensions=Arabic}/u;
const LETTER = /\p{L}/u;
const NUMBER = /\p{N}/u;
const SPACE = /\s/u;

/**
 * Number of characters after which `letter-spacing` is applied, matching
 * Blink's cursive-script suppression (Latin/CJK count every codepoint).
 */
export function letterSpacingPositions(text: string): number {
  const chars = [...text];
  let n = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (SPACE.test(c)) {
      n++;
      continue;
    }
    if (ARABIC.test(c)) continue;
    if (LETTER.test(c) || NUMBER.test(c)) {
      n++;
      continue;
    }
    const prevArabic = i > 0 && ARABIC.test(chars[i - 1]);
    const nextArabic = i + 1 < chars.length && ARABIC.test(chars[i + 1]);
    if (!(prevArabic && nextArabic)) n++;
  }
  return n;
}
