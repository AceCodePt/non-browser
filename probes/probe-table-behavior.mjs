#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function probe(name, html, ids) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) };
    });
  }
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(rects));
  return rects;
}

async function computed(name, html, specs) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const out = {};
  for (const [id, props] of specs) {
    out[id] = await page.evaluate(({ id, props }) => {
      const cs = getComputedStyle(document.getElementById(id));
      const o = {};
      for (const p of props) o[p] = cs.getPropertyValue(p);
      return o;
    }, { id, props });
  }
  console.log(`=== computed ${name} ===`);
  console.log(JSON.stringify(out));
}

// 1. border-spacing edges: table border 1px, spacing 2px (default), padding 0
await probe('spacing-edges', `${H}<table id="t" style="border:1px solid #000;border-spacing:2px"><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`, ['t', 'r1', 'a']);

// 2. table padding
await probe('table-padding', `${H}<table id="t" style="border-spacing:0;padding:10px"><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`, ['t', 'r1', 'a']);

// 3. default spacing auto width (spacing 2 default, td padding default 1px)
await probe('auto-spacing2', `${H}<table id="t"><tr id="r1"><td id="a">A</td><td id="b">BBBB</td></tr></table></body></html>`, ['t', 'r1', 'a', 'b']);

// 4. caption: top, with margin; spacing 2
await probe('caption-top', `${H}<table id="t" style="border-spacing:2px"><caption id="cap" style="margin:0;padding:0">Cap</caption><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`, ['t', 'cap', 'r1', 'a']);
await probe('caption-bottom', `${H}<table id="t" style="border-spacing:2px"><caption id="cap" style="caption-side:bottom;margin:0;padding:0">Cap</caption><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`, ['t', 'cap', 'r1', 'a']);
await probe('caption-margin', `${H}<table id="t" style="border-spacing:0"><caption id="cap" style="margin:5px 0;padding:0">Cap</caption><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`, ['t', 'cap', 'r1', 'a']);
await probe('caption-border-table', `${H}<table id="t" style="border:1px solid #000;border-spacing:0"><caption id="cap" style="margin:0;padding:0">Cap</caption><tr id="r1"><td id="a" style="padding:0">A</td></tr></table></body></html>`, ['t', 'cap', 'r1', 'a']);

// 5. HTML table stray text / stray div / stray td
await probe('html-stray-text', `${H}<div id="wrap"><table id="t" style="border-spacing:0"><tr id="r1"><td id="a" style="padding:0">A</td></tr>stray text here<tr id="r2"><td id="b" style="padding:0">B</td></tr></table></div><div id="after">after</div></body></html>`, ['wrap', 't', 'r1', 'a', 'r2', 'b', 'after']);
await probe('html-stray-div', `${H}<div id="wrap"><table id="t" style="border-spacing:0"><tr id="r1"><td id="a" style="padding:0">A</td></tr><div id="stray" style="display:block;width:100px">stray block</div><tr id="r2"><td id="b" style="padding:0">B</td></tr></table></div></body></html>`, ['wrap', 't', 'r1', 'a', 'stray', 'r2', 'b']);
await probe('html-stray-td', `${H}<table id="t" style="border-spacing:0"><td id="a" style="padding:0">A</td></table></body></html>`, ['t', 'a']);

// 6. CSS display:table with cells direct children / row direct in table
await probe('css-direct-cell', `${H}<div id="t" style="display:table;border-spacing:0"><div id="a" style="display:table-cell;padding:0">A</div></div></body></html>`, ['t', 'a']);
await probe('css-row-in-table', `${H}<div id="t" style="display:table;border-spacing:0"><div id="r1" style="display:table-cell;padding:0">c</div><div id="r2" style="display:table-row"><div id="a" style="display:table-cell;padding:0">A</div></div></div></body></html>`, ['t', 'r1', 'r2', 'a']);

// 7. mixed row heights + rowspan excess distribution
await probe('rowspan-mixed', `${H}<table id="t" style="border-spacing:0"><tr id="r1"><td id="a" style="padding:0" rowspan="2">A<br>B<br>C<br>D<br>E</td><td id="b" style="padding:0">B</td></tr><tr id="r2"><td id="c" style="padding:0">C<br>D</td></tr></table></body></html>`, ['t', 'r1', 'r2', 'a', 'b', 'c']);

// 8. table specified height
await probe('table-height', `${H}<table id="t" style="border-spacing:0;height:100px"><tr id="r1"><td id="a" style="padding:0">A</td></tr><tr id="r2"><td id="b" style="padding:0">B</td></tr></table></body></html>`, ['t', 'r1', 'r2', 'a', 'b']);

// 9. valign baseline: two cells with different font sizes
await probe('valign-baseline', `${H}<table id="t" style="border-spacing:0"><tr id="r1" style="height:60px"><td id="a" style="padding:0;vertical-align:baseline">Ab</td><td id="b" style="padding:0;vertical-align:baseline;font-size:24px">Cd</td><td id="c" style="padding:0;vertical-align:top">Ef</td></tr></table></body></html>`, ['t', 'r1', 'a', 'b', 'c']);
const frags = await page.evaluate(() => {
  const out = {};
  for (const id of ['a', 'b', 'c']) {
    const el = document.getElementById(id);
    const range = document.createRange();
    range.selectNodeContents(el);
    out[id] = [...range.getClientRects()].map((r) => ({ x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) }));
  }
  return out;
});
console.log('valign-baseline text:', JSON.stringify(frags));

// 10. col width in auto layout
await probe('col-width-auto', `${H}<table id="t" style="width:300px;border-spacing:0"><colgroup><col id="c1" style="width:100px"><col></colgroup><tr id="r1"><td id="a" style="padding:0">A</td><td id="b" style="padding:0">BBBB</td></tr></table></body></html>`, ['t', 'r1', 'a', 'b']);

// 11. nested table
await probe('nested-table', `${H}<table id="t" style="border-spacing:0"><tr><td id="cell" style="padding:0"><table id="inner" style="border-spacing:0"><tr><td id="ic" style="padding:0;width:60px">inner</td></tr></table></td></tr></table></body></html>`, ['t', 'cell', 'inner', 'ic']);

// 12. percentage table width
await probe('pct-table', `${H}<div style="width:400px"><table id="t" style="width:50%;border-spacing:0"><tr><td id="a" style="padding:0">A</td><td id="b" style="padding:0">BBBB</td></tr></table></div></body></html>`, ['t', 'a', 'b']);

// 13. inline-table baseline
await probe('inline-table', `${H}<div style="font-size:16px;line-height:32px">Xx<table id="it" style="display:inline-table;border-spacing:0;vertical-align:baseline"><tr><td id="ic" style="padding:0">Ib</td></tr></table>Yy</div></body></html>`, ['it', 'ic']);
const frags2 = await page.evaluate(() => {
  const out = {};
  for (const id of ['it', 'ic']) {
    const el = document.getElementById(id);
    const range = document.createRange();
    range.selectNodeContents(el);
    out[id] = [...range.getClientRects()].map((r) => ({ x: +r.x.toFixed(3), y: +r.y.toFixed(3) }));
  }
  return out;
});
console.log('inline-table text:', JSON.stringify(frags2));

// 14. computed styles for table parts
await computed('table-parts', `${H}<table id="t"><caption id="cap">C</caption><thead id="th1"><tr id="r1"><th id="h">H</th></tr></thead><tbody id="tb"><tr id="r2"><td id="d">D</td></tr></tbody></table></body></html>`, [
  ['t', ['display', 'border-collapse', 'border-spacing', 'caption-side', 'table-layout', 'empty-cells', 'padding-top', 'border-top-width']],
  ['cap', ['display', 'text-align']],
  ['th1', ['display', 'vertical-align']],
  ['r1', ['display', 'vertical-align']],
  ['h', ['display', 'font-weight', 'text-align', 'padding-top', 'vertical-align', 'border-top-width', 'border-top-style']],
  ['d', ['display', 'font-weight', 'vertical-align', 'padding-top']],
  ['tb', ['display', 'vertical-align']],
]);

// 15. margin on cells
await probe('cell-margin', `${H}<table id="t" style="border-spacing:0"><tr><td id="a" style="padding:0;margin:10px">A</td><td id="b" style="padding:0">B</td></tr></table></body></html>`, ['t', 'a', 'b']);

// 16. rowspan cell with vertical-align middle in spanned area + row default heights
await probe('row-group-anon-text', `${H}<div id="t" style="display:table;border-spacing:0"><div id="rg" style="display:table-row-group">stray</div></div></body></html>`, ['t', 'rg']);

await browser.close();
