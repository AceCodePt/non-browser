/**
 * Shared sweep definitions for the programmatic value-sweep (coverage-matrix
 * task): the property/value axes and the fixture HTML builders for
 * corpus/sweep-flexbox/ and corpus/sweep-grid/.
 *
 * Owned by `scripts/generate-sweep.mjs` (generates fixtures + records
 * expectations from a live four-layer run) and `scripts/verify-sweep.mjs`
 * (re-diffs and asserts the recorded expectations still hold). Nothing here is
 * hand-authored: every fixture is one cell of the cartesian product below.
 */

/** Flexbox sweep axes (charter §11 coverage matrix flex rows). */
export const FLEX_AXES = {
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'],
};

/** Grid sweep axes (charter §11 coverage matrix grid rows). */
export const GRID_AXES = {
  'grid-template-columns': ['1fr 1fr', 'repeat(2, 80px)', 'minmax(60px, 1fr) 1fr', '100px 1fr 2fr', 'repeat(2, 30%) 1fr'],
  gap: ['0', '4px', '8px', '12px'],
};

/** Deterministic fixture name for a flex combo. */
export function flexComboLabel(wrap, jc, ai) {
  return `flex-${wrap}-${jc}-${ai}`;
}

/** Deterministic fixture name for a grid combo. */
export function gridComboLabel(template, gap) {
  return `grid-${gap.replace(/[^0-9a-z]/gi, '') || '0'}-${template.replace(/[^0-9a-z]/gi, '')}`;
}

/** HTML for one flex sweep fixture. */
export function flexHtml(wrap, jc, ai) {
  return (
    `<html><head><style>html,body{margin:0;padding:0}</style></head><body>` +
    `<div id="c" style="display:flex;flex-wrap:${wrap};justify-content:${jc};align-items:${ai};width:300px;height:120px;gap:8px;background:#f0f0f0">` +
    `<div id="a" style="width:90px;height:40px;background:#4a90d9"></div>` +
    `<div id="b" style="width:70px;height:60px;background:#d9534f"></div>` +
    `<div id="e" style="width:110px;height:30px;background:#90b04f"></div>` +
    `<div id="d" style="width:60px;height:50px;background:#d0a0a0"></div>` +
    `</div></body></html>`
  );
}

/** HTML for one grid sweep fixture. */
export function gridHtml(template, gap) {
  return (
    `<html><head><style>html,body{margin:0;padding:0}</style></head><body>` +
    `<div id="g" style="display:grid;grid-template-columns:${template};gap:${gap};width:320px;background:#f0f0f0">` +
    `<div id="a" style="background:#4a90d9"></div>` +
    `<div id="b" style="background:#d9534f"></div>` +
    `<div id="e" style="background:#90b04f"></div>` +
    `<div id="d" style="background:#d0a0a0"></div>` +
    `<div id="f" style="background:#a0d0d0"></div>` +
    `<div id="z" style="background:#e0c0a0"></div>` +
    `</div></body></html>`
  );
}

/** The full cartesian product: { feature, label, dirName, viewport, html, rects }. */
export function sweepCombos() {
  const combos = [];
  for (const wrap of FLEX_AXES['flex-wrap']) {
    for (const jc of FLEX_AXES['justify-content']) {
      for (const ai of FLEX_AXES['align-items']) {
        combos.push({
          feature: 'flex',
          label: `${wrap}/${jc}/${ai}`,
          dirName: flexComboLabel(wrap, jc, ai),
          viewport: { width: 320, height: 140 },
          html: flexHtml(wrap, jc, ai),
          rects: ['c', 'a', 'b', 'e', 'd'],
        });
      }
    }
  }
  for (const template of GRID_AXES['grid-template-columns']) {
    for (const gap of GRID_AXES.gap) {
      combos.push({
        feature: 'grid',
        label: `${template}/${gap}`,
        dirName: gridComboLabel(template, gap),
        viewport: { width: 340, height: 220 },
        html: gridHtml(template, gap),
        rects: ['g', 'a', 'b', 'e', 'd', 'f', 'z'],
      });
    }
  }
  return combos;
}
