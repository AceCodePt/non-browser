#!/usr/bin/env node
// Dev probe: Chrome's border-collapse: collapse geometry, conflict resolution,
// and border paint placement. Answers (with rects + pixel scans) what the
// engine must reproduce:
//   - where the collapsed border paints relative to cell/table rects
//   - whether cell rects overlap at shared edges, and by how much
//   - which candidate wins each conflict case (width/style/source precedence)
//   - border-radius on a collapsed table/cell (rendered or ignored)
import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
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
  for (const s of scans) {
    const runs = [];
    let prev = null;
    let start = null;
    const [x0, y0, dx, dy, len] = s;
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
  return rects;
}

// 1. Basic: 2x2, 4px solid cell borders, fixed 100px cells, 10px padding.
const base = `${H}<table id="t" style="border-collapse:collapse"><tr id="r1"><td id="a" style="border:4px solid #ff0000;background:#ffffff;width:100px;height:50px;padding:10px">A</td><td id="b" style="border:4px solid #00ff00;background:#ffffff;width:100px;height:50px;padding:10px">B</td></tr><tr id="r2"><td id="c" style="border:4px solid #0000ff;background:#ffffff;width:100px;height:50px;padding:10px">C</td><td id="d" style="border:4px solid #ff00ff;background:#ffffff;width:100px;height:50px;padding:10px">D</td></tr></table></body></html>`;
const r1 = await probe('basic-2x2-4px', base, ['t', 'a', 'b', 'c', 'd'], []);
// vertical scan through row 1 center: where do the 4px borders paint?
{
  const yc = Math.round(r1.a.y + r1.a.height / 2);
  await probe('basic-2x2-4px-scans', base, ['t', 'a'], [
    [0, yc, 1, 0, Math.ceil(r1.t.width + 20)],
  ]);
}

// 2. Table border 10px, cells borderless.
{
  const h = `${H}<table id="t" style="border-collapse:collapse;border:10px solid #0000ff"><tr id="r1"><td id="a" style="width:100px;height:50px;padding:10px;background:#eeeeee">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#eeeeee">B</td></tr></table></body></html>`;
  const rr = await probe('table-border-10px', h, ['t', 'a', 'b']);
  const yc = Math.round(rr.a.y + rr.a.height / 2);
  await probe('table-border-10px-scan', h, ['t'], [[0, yc, 1, 0, Math.ceil(rr.t.width + 30)]]);
}

// 3. Table border 10px + cell 4px: who wins at the outer edge, where does the cell start?
{
  const h = `${H}<table id="t" style="border-collapse:collapse;border:10px solid #0000ff"><tr id="r1"><td id="a" style="border:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td></tr></table></body></html>`;
  const rr = await probe('table10-cell4', h, ['t', 'a']);
  const yc = Math.round(rr.a.y + rr.a.height / 2);
  await probe('table10-cell4-scan', h, ['t'], [[0, yc, 1, 0, Math.ceil(rr.t.width + 30)]]);
}

// 4. Cell 10px vs table 4px at the outer edge.
{
  const h = `${H}<table id="t" style="border-collapse:collapse;border:4px solid #0000ff"><tr id="r1"><td id="a" style="border:10px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td></tr></table></body></html>`;
  const rr = await probe('table4-cell10', h, ['t', 'a']);
  const yc = Math.round(rr.a.y + rr.a.height / 2);
  await probe('table4-cell10-scan', h, ['t'], [[0, yc, 1, 0, Math.ceil(rr.t.width + 40)]]);
}

// 5. Conflict: 2px red right vs 5px blue left (shared edge).
await probe('conflict-width', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:2px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:5px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b']);

// 6. Conflict: same width, solid red vs dashed blue.
await probe('conflict-style', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:4px dashed #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b']);

// 7. Conflict: same width same style, red vs blue — source order (left wins ltr).
await probe('conflict-source', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b']);

// 8. Conflict: cell 4px solid vs row 4px solid (row sets border on top/bottom).
await probe('conflict-cell-row', `${H}<table id="t" style="border-collapse:collapse"><tr id="r1" style="border-bottom:4px solid #00aa00"><td id="a" style="border-right:1px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr id="r2"><td id="c" style="border-top:1px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">C</td><td id="d" style="width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'r1', 'r2', 'a', 'b', 'c', 'd']);

// 9. Conflict: col vs cell (same width solid, different colors).
await probe('conflict-col-cell', `${H}<table id="t" style="border-collapse:collapse"><col id="col1" style="border-right:4px solid #00aa00"><col id="col2"><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b']);

// 10. Conflict: table vs cell same width solid.
await probe('conflict-table-cell', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr><td id="a" style="border-right:4px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="width:100px;height:50px;padding:10px;background:#ffffff">C</td><td id="d" style="width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// 11. hidden kills everything; none loses to solid.
await probe('conflict-hidden', `${H}<table id="t" style="border-collapse:collapse;border:4px solid #00aa00"><tr><td id="a" style="border:4px hidden #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="border:4px none;width:100px;height:50px;padding:10px;background:#ffffff">C</td><td id="d" style="border:4px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// 12. Border-radius on collapsed table + cell.
await probe('radius-collapse', `${H}<table id="t" style="border-collapse:collapse;border-radius:16px;border:4px solid #00aa00"><tr><td id="a" style="border:4px solid #ff0000;border-radius:12px;width:100px;height:50px;padding:10px;background:#ffdddd">A</td></tr></table></body></html>`, ['t', 'a'], []);
const radiusComputed = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('a'));
  return { radius: cs.borderRadius, collapse: cs.borderCollapse };
});
console.log('=== radius-collapse computed ===');
console.log(JSON.stringify(radiusComputed));

// 13. Cell rect overlap with rowspan + unequal borders (rowspan left 6px, right cells 2px).
await probe('rowspan-unequal', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" rowspan="2" style="border:6px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border:2px solid #00ff00;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="border:2px solid #0000ff;width:100px;height:50px;padding:10px;background:#ffffff">C</td></tr></table></body></html>`, ['t', 'a', 'b', 'c']);

// 14. Pattern styles on collapsed borders (dashed/double on the shared edge).
await probe('pattern-collapse', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:6px double #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:6px dashed #00aa00;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`, ['a', 'b']);

// 15. Row group (thead/tbody) borders + section edge resolution.
await probe('rowgroup', `${H}<table id="t" style="border-collapse:collapse"><thead id="th" style="border:3px solid #00aa00"><tr><td id="a" style="border:1px solid #ff0000;width:100px;height:40px;padding:10px;background:#ffffff">A</td><td id="b" style="border:1px solid #0000ff;width:100px;height:40px;padding:10px;background:#ffffff">B</td></tr></thead><tbody id="tb" style="border-top:5px solid #f0c040"><tr><td id="c" style="border:1px solid #ff00ff;width:100px;height:40px;padding:10px;background:#ffffff">C</td><td id="d" style="border:1px solid #00ffff;width:100px;height:40px;padding:10px;background:#ffffff">D</td></tr></tbody></table></body></html>`, ['t', 'a', 'b', 'c', 'd']);

// 16. Odd width (3px) border paint placement: 1.5px centered — pixel snap check.
{
  const h = `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:3px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`;
  const rr = await probe('odd-3px', h, ['t', 'a', 'b']);
  const yc = Math.round(rr.a.y + rr.a.height / 2);
  await probe('odd-3px-scan', h, ['t'], [[0, yc, 1, 0, Math.ceil(rr.t.width + 10)]]);
}

// 17. 1px shared border: sub-pixel halves 0.5/0.5.
{
  const h = `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border-right:1px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border-left:1px solid #ff0000;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr></table></body></html>`;
  const rr = await probe('odd-1px', h, ['t', 'a', 'b']);
  const yc = Math.round(rr.a.y + rr.a.height / 2);
  await probe('odd-1px-scan', h, ['t'], [[0, yc, 1, 0, Math.ceil(rr.t.width + 10)]]);
}

// 18. inset/outset/groove/ridge collapsed rendering.
await probe('io-collapse', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border:6px inset #808080;width:100px;height:50px;padding:10px;background:#ffffff">A</td><td id="b" style="border:6px outset #808080;width:100px;height:50px;padding:10px;background:#ffffff">B</td></tr><tr><td id="c" style="border:6px groove #808080;width:100px;height:50px;padding:10px;background:#ffffff">C</td><td id="d" style="border:6px ridge #808080;width:100px;height:50px;padding:10px;background:#ffffff">D</td></tr></table></body></html>`, ['a', 'b', 'c', 'd']);

// 19. width distribution: collapse removes spacing; table auto width = sum cells.
await probe('widths', `${H}<table id="t" style="border-collapse:collapse"><tr><td id="a" style="border:4px solid #ff0000;width:50px;padding:2px;background:#ffffff">A</td><td id="b" style="border:4px solid #00ff00;width:50px;padding:2px;background:#ffffff">B</td></tr></table></body></html>`, ['t', 'a', 'b']);

// 20. border-spacing ignored in collapse + computed styles.
const computed = await page.evaluate(() => {
  const t = document.createElement('table');
  t.style.borderCollapse = 'collapse';
  t.innerHTML = '<tr><td id="x">x</td></tr>';
  document.body.appendChild(t);
  const csT = getComputedStyle(t);
  const csTd = getComputedStyle(t.querySelector('td'));
  return {
    tableCollapse: csT.borderCollapse,
    tableSpacing: csT.borderSpacing,
    tdCollapse: csTd.borderCollapse,
    tdSpacing: csTd.borderSpacing,
  };
});
console.log('=== computed collapse/spacing ===');
console.log(JSON.stringify(computed));

await browser.close();
