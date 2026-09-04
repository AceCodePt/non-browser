#!/usr/bin/env node
// Dev probe 4: style-precedence ranks (enum order), table padding in collapse,
// computed styles for collapsed cells, empty table, corner raster.
import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
const H = "<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans';font-size:16px}</style></head><body>";
const cell = (id, style, text) => `<td id="${id}" style="width:100px;height:30px;padding:0;background:#ffffff;${style}">${text}</td>`;

async function probe(name, html, ids, scans = []) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) };
    });
  }
  const img = decodePng(await page.screenshot());
  const px = (x, y) => {
    const o = (y * img.width + x) * 4;
    return `#${img.data[o].toString(16).padStart(2, '0')}${img.data[o + 1].toString(16).padStart(2, '0')}${img.data[o + 2].toString(16).padStart(2, '0')}`;
  };
  console.log(`=== ${name} === ${JSON.stringify(rects)}`);
  for (const [x0, y0, dx, dy, len] of scans) {
    const runs = [];
    let prev = null;
    let start = null;
    for (let i = 0; i < len; i++) {
      const c = px(x0 + dx * i, y0 + dy * i);
      if (c !== prev) {
        if (prev !== null && prev !== '#ffffff') runs.push(`${prev}@${start}..${i - 1}(w${i - start})`);
        prev = c;
        start = i;
      }
    }
    if (prev !== null && prev !== '#ffffff') runs.push(`${prev}@${start}..${len - 1}(w${len - start})`);
    console.log(`scan(${x0},${y0} d(${dx},${dy}) len${len}): ${runs.join(' ')}`);
  }
}

// Style precedence at equal width: loser vs winner on the shared edge.
// EBorderStyle enum claim: none < hidden < inset < groove < outset < ridge < dotted < dashed < solid < double
await probe('rank-inset-vs-groove', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border-right:6px inset #ff0000', 'A')}${cell('b', 'border-left:6px groove #0000ff', 'B')}</tr></table></body></html>`, ['a', 'b'], [[95, 15, 1, 0, 20]]);
await probe('rank-outset-vs-ridge', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border-right:6px outset #ff0000', 'A')}${cell('b', 'border-left:6px ridge #0000ff', 'B')}</tr></table></body></html>`, ['a', 'b'], [[95, 15, 1, 0, 20]]);
await probe('rank-dotted-vs-dashed', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border-right:6px dotted #ff0000', 'A')}${cell('b', 'border-left:6px dashed #0000ff', 'B')}</tr></table></body></html>`, ['a', 'b'], [[95, 15, 1, 0, 20]]);
await probe('rank-solid-vs-double', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border-right:6px solid #ff0000', 'A')}${cell('b', 'border-left:6px double #0000ff', 'B')}</tr></table></body></html>`, ['a', 'b'], [[95, 15, 1, 0, 20]]);
await probe('rank-double-vs-solid', `${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border-right:6px double #ff0000', 'A')}${cell('b', 'border-left:6px solid #0000ff', 'B')}</tr></table></body></html>`, ['a', 'b'], [[95, 15, 1, 0, 20]]);

// Table padding ignored in collapse?
await probe('table-padding-collapse', `${H}<table id="t" style="border-collapse:collapse;padding:15px;border-spacing:9px"><tr>${cell('a', 'border:4px solid #ff0000', 'A')}</tr></table></body></html>`, ['t', 'a']);

// Computed styles on a collapsed cell.
await page.setContent(`${H}<table id="t" style="border-collapse:collapse"><tr>${cell('a', 'border:4px solid #ff0000', 'A')}</tr></table></body></html>`);
const cs = await page.evaluate(() => {
  const td = document.querySelector('td');
  const s = getComputedStyle(td);
  const t = getComputedStyle(document.getElementById('t'));
  return {
    tdCollapse: s.borderCollapse,
    tdTopWidth: s.borderTopWidth,
    tdTopStyle: s.borderTopStyle,
    tdTopColor: s.borderTopColor,
    tPadding: t.padding,
    tSpacing: t.borderSpacing,
    tRadius: t.borderRadius,
  };
});
console.log(`computed: ${JSON.stringify(cs)}`);

// Corner raster of the basic 2x2 4px case: scan the top-left corner block.
await probe('corner-2x2', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffdddd">A</td><td id="b" style="border:4px solid #00ff00;width:100px;height:50px;padding:10px;background:#ddffdd">B</td></tr><tr><td id="c" style="border:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ddddff">C</td><td id="d" style="border:4px solid #f0c040;width:100px;height:50px;padding:10px;background:#fff8e0">D</td></tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd'], [
  [0, 0, 1, 0, 8],
  [0, 0, 0, 1, 8],
  [122, 48, 1, 0, 10],
  [0, 100, 1, 0, 8],
]);

// Row border left/right on rows (outer vertical edges per row).
await probe('row-side-borders', `${H}<table id="t" style="border-collapse:collapse"><tr id="r1" style="border-left:6px solid #ff0000;border-right:6px solid #00ff00">${cell('a', '', 'A')}${cell('b', '', 'B')}</tr><tr id="r2">${cell('c', 'border:6px solid #0000ff', 'C')}${cell('d', '', 'D')}</tr></table></body></html>`, ['t', 'r1', 'r2', 'a', 'b', 'c', 'd'], [[0, 15, 1, 0, 12], [0, 45, 1, 0, 12]]);

await browser.close();
