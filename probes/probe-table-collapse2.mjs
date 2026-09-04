#!/usr/bin/env node
// Dev probe 2: remaining border-collapse questions — winner paint colors,
// hidden-border layout widths, radius-on-collapse raster, row border halves,
// first-row outer-border rule, fractional border paint placement.
import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 1200 } });
const H = "<html><head><style>html,body{margin:0;padding:0;font-family:'Noto Sans';font-size:16px}</style></head><body>";

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
  const shot = await page.screenshot();
  const img = decodePng(shot);
  const px = (x, y) => {
    const o = (y * img.width + x) * 4;
    return `#${img.data[o].toString(16).padStart(2, '0')}${img.data[o + 1].toString(16).padStart(2, '0')}${img.data[o + 2].toString(16).padStart(2, '0')}`;
  };
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(rects));
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
  return { rects, img };
}

// 1. Winner colors: cell 2px red right vs cell 5px blue left.
await probe('winner-width', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:2px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:5px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b'], [[110, 25, 1, 0, 30]]);

// 2. Same width, dashed a-right vs solid b-left (solid wins).
await probe('winner-style', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:4px dashed #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b'], [[110, 25, 1, 0, 30]]);

// 3. Same width same style: left cell wins (red expected).
await probe('winner-source', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b'], [[110, 25, 1, 0, 30]]);

// 4. col vs cell same width: cell expected to win (red).
await probe('winner-col-cell', `${H}<table id="t" style="border-collapse:collapse"><col style="border-right:4px solid #00aa00"><col><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b'], [[110, 25, 1, 0, 30]]);

// 5. table vs cell same width at shared edge and outer edge.
await probe('winner-table-cell', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="width:100px;height:50px;padding:10px;background:#ffffff">C</td><td id="d" style="width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd'], [[110, 25, 1, 0, 30], [0, 25, 1, 0, 12], [0, 76, 1, 0, 12]]);

// 6. hidden suppresses paint; none loses. Scan shared a/b edge and outer left.
await probe('winner-hidden', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr><td id="a" style="border:4px hidden #ff0000;width:100px;height:50px;padding:10px;background:#ffdddd">A</td><td id="b" style="border:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="border:4px none #ff0000;width:100px;height:50px;padding:10px;background:#ddddff">C</td><td id="d" style="border:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd'], [[110, 25, 1, 0, 30], [0, 25, 1, 0, 12], [110, 76, 1, 0, 30]]);

// 7. hidden 8px vs solid 4px: layout width source (8 vs 4) and paint (nothing).
await probe('hidden-width', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:8px hidden #ff0000;width:100px;height:50px;padding:10px;background:#ffdddd">A</td><td id="b" style="border-left:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b'], [[110, 25, 1, 0, 30]]);

// 8. lone hidden border cell: does the hidden width count alone?
await probe('hidden-alone', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border:4px hidden #ff0000;width:100px;height:50px;padding:10px;background:#ffdddd">A</td></tr></table></body></html>`, ['t', 'a'], []);

// 9. radius on collapsed table+cell: identical raster to no-radius?
{
  const base = `<table id="t" style="border-collapse:collapse;border:6px solid #00aa00"><tr><td id="a" style="border:6px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffdddd">A</td></tr></table>`;
  await page.setContent(`${H}${base}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const shotNoRadius = decodePng(await page.screenshot());
  await page.setContent(`${H}<style>#t{border-radius:20px}#a{border-radius:14px}</style>${base}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const shotRadius = decodePng(await page.screenshot());
  let diff = 0;
  for (let i = 0; i < shotNoRadius.data.length; i += 4) {
    if (Math.abs(shotNoRadius.data[i] - shotRadius.data[i]) > 8 || Math.abs(shotNoRadius.data[i + 1] - shotRadius.data[i + 1]) > 8 || Math.abs(shotNoRadius.data[i + 2] - shotRadius.data[i + 2]) > 8) diff++;
  }
  console.log(`=== radius-on-collapse === diffPxls=${diff} of ${(shotNoRadius.data.length / 4) | 0}`);
}

// 10. Row border halves with pure content rows (no specified heights).
await probe('row-halves', `${H}<table id="t" style="border-collapse:collapse"><tr id="r1" style="border-bottom:6px solid #00aa00"><td id="a" style="border-right:1px solid #ff0000;padding:0;background:#ffffff">A</td><td id="b" style="padding:0;background:#ffffff">B</td></tr><tr id="r2"><td id="c" style="border-top:1px solid #0000ff;padding:0;background:#ffffff">C</td><td id="d" style="padding:0;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'r1', 'r2', 'a', 'b', 'c', 'd'], [[50, 0, 0, 1, 60]]);

// 11. First-row rule: later row has a bigger left border — spill or grow?
await probe('first-row-rule', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="width:100px;height:30px;padding:0;background:#ffffff">A</td></tr><tr><td id="b" style="border-left:12px solid #ff0000;width:100px;height:30px;padding:0;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b'], [[0, 45, 1, 0, 20]]);

// 12. Max over all top cells: row2 cell has a 10px top border vs row1 none.
await probe('top-max', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="width:100px;height:30px;padding:0;background:#ffffff">A</td></tr><tr><td id="b" style="border-top:10px solid #ff0000;width:100px;height:30px;padding:0;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b'], [[50, 0, 0, 1, 50]]);

// 13. Fractional shared border paint: 5px border at grid 122.5.
await probe('frac-border', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:5px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:5px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b'], [[115, 25, 1, 0, 20]]);

// 14. inset/outset collapsed shading (scan shared vertical edges).
await probe('io-scan', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:6px inset #808080;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border:6px outset #808080;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b'], [[110, 25, 1, 0, 36], [3, 25, 1, 0, 12]]);

// 15. colgroup border.
await probe('colgroup', `${H}<table id="t" style="border-collapse:collapse"><colgroup id="cg" style="border-right:4px solid #00aa00"><col><col></colgroup><tr><td id="a" style="width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="width:100px;height:50px;padding:10px;background:#ffffff">C</td><td id="d" style="width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd'], [[228, 25, 1, 0, 20]]);

await browser.close();
