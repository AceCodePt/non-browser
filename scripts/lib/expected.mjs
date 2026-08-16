/**
 * Shared reading of the typed per-layer fixture `expected` schema.
 *
 * A fixture's `expected` is an object keyed by layer name. Each layer value is
 * either the string `'pass'` or a typed gap declaration:
 *
 *   { "result": "fail", "reason": "...", "sunset": "..." }
 *
 * The top-level string `"fail"` shorthand is retired (improvement-plan §4);
 * scripts and the check step must go through these helpers so they agree on the
 * single normalized form.
 */

export const LAYER_NAMES = ['measureText', 'computedStyle', 'rect', 'screenshot'];

export function isGapExpectation(ex) {
  return !!ex && typeof ex === 'object' && !Array.isArray(ex) && ex.result === 'fail';
}

export function gapLayers(rawExpected) {
  if (!rawExpected || typeof rawExpected !== 'object' || Array.isArray(rawExpected)) return [];
  return LAYER_NAMES.filter((layer) => isGapExpectation(rawExpected[layer]));
}

export function expectedLabel(rawExpected) {
  return gapLayers(rawExpected).length > 0 ? 'fail' : 'pass';
}
