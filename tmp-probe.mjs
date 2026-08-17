import { loadTolerances } from './dist/harness/tolerances.js';
import { getMeasurementCanvas, measureTextWidth } from './dist/layout/measure.js';
import { installPretextMeasurement, prepareText, layoutLines } from './dist/pretext/index.js';
import { readFileSync } from 'node:fs';

const tols = loadTolerances('tolerances.json');
console.log('meanPx', tols.layers.measureText.meanPx, 'maxPx', tols.layers.measureText.maxPx);

installPretextMeasurement(getMeasurementCanvas());

for (const name of ['basic-text', 'wrapping', 'inline-styles', 'boxes', 'replaced-boxes']) {
  const raw = JSON.parse(readFileSync(`corpus/spine/${name}/fixture.json`, 'utf8'));
  const h = raw.harvest;
  const texts = [];
  for (const id of h.textElements ?? []) {
    const m = h.html.match(new RegExp(`id="${id}"[^>]*>([^<]*)</`));
    if (m) texts.push({ id, text: m[1] });
  }
  console.log(`\n=== ${name} ===`);
  for (const { id, text } of texts) {
    const prepared = prepareText(text, "16px 'Noto Sans'", {});
    const res = layoutLines(prepared, 300, 24);
    for (const l of res.lines) {
      const rawW = measureTextWidth(l.text, 16, 'Noto Sans');
      console.log(`${id}: ${JSON.stringify(l.text)} pretext=${l.width.toFixed(4)} engine=${rawW.toFixed(4)} diff=${Math.abs(l.width - rawW).toFixed(4)}`);
    }
  }
}