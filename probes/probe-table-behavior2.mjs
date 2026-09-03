#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function probe(name, html, ids, textIds = []) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const rects = {};
  for (const id of ids) {
    rects[id] = await page.$eval(`#${id}`, (el) => {
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) };
    });
  }
  for (const id of textIds) {
    rects[id + ':text'] = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const range = document.createRange();
      range.selectNodeContents(el);
      return [...range.getClientRects()].map((r) => ({ x: +r.x.toFixed(3), y: +r.y.toFixed(3), width: +r.width.toFixed(3), height: +r.height.toFixed(3) }));
    }, id);
  }
  console.log(`=== ${name} ===`);
  console.log(JSON.stringify(rects));
}

const S = 'border-collapse:separate;border-spacing:0';

// auto layout: specified cell width smaller than content max
await probe('auto-spec-narrow', `${H}<table style="width:300px;${S}"><tr><td id="a" style="padding:0;width:30px">longer text here</td><td id="b" style="padding:0">BBBB</td></tr></table></body></html>`, ['a', 'b']);
// auto layout: two specified cells
await probe('auto-two-spec', `${H}<table style="width:400px;${S}"><tr><td id="a" style="padding:0;width:100px">A</td><td id="b" style="padding:0;width:50px">BBBB</td><td id="c" style="padding:0">C</td></tr></table></body></html>`, ['a', 'b', 'c']);
// middle valign content position
await probe('valign-mid2', `${H}<table style="${S}"><tr id="r1" style="height:60px"><td id="a" style="padding:0">text</td><td id="b" style="padding:0;vertical-align:bottom">low</td></tr></table></body></html>`, ['a', 'b'], ['a', 'b']);
// two rowspan cells starting in different rows (step 2 of height distribution)
await probe('rowspan-two', `${H}<table style="${S}"><tr id="r1"><td id="a" style="padding:0" rowspan="3">A<br>B<br>C<br>D<br>E<br>F</td><td id="b" style="padding:0">one</td></tr><tr id="r2"><td id="c" style="padding:0" rowspan="2">x<br>y<br>z<br>w</td></tr><tr id="r3"><td id="d" style="padding:0">three</td></tr></table></body></html>`, ['r1', 'r2', 'r3', 'a', 'b', 'c', 'd']);
// table height with constrained rows
await probe('table-height-constrained', `${H}<table style="${S};height:100px"><tr id="r1" style="height:20px"><td id="a" style="padding:0">A</td></tr><tr id="r2"><td id="b" style="padding:0">B</td></tr></table></body></html>`, ['r1', 'r2', 'a', 'b']);
// percent width on td with spacing 2
await probe('auto-pct-spacing', `${H}<table style="width:300px"><tr><td id="a" style="padding:0;width:50%">A</td><td id="b" style="padding:0">BBBB</td></tr></table></body></html>`, ['a', 'b']);
// stray text + td directly in tr (anonymous cell in row)
await probe('anon-cell-in-row', `${H}<table id="t" style="${S}"><tr id="r1"><td id="a" style="padding:0">A</td>stray in row<td id="b" style="padding:0">B</td></tr></table></body></html>`, ['t', 'r1', 'a', 'b']);
// empty-cells hide (paint check comes from screenshots)
await probe('empty-hide', `${H}<table style="${S};border-spacing:4px"><tr><td id="a" style="padding:0;border:2px solid #000;empty-cells:hide"></td><td id="b" style="padding:0;border:2px solid #000">B</td></tr></table></body></html>`, ['a', 'b']);
// nested rows in tbody ordering thead/tbody/tfoot
await probe('sections', `${H}<table id="t" style="${S}"><thead id="hd"><tr id="r1"><td id="a" style="padding:0">H</td></tr></thead><tbody id="bd"><tr id="r2"><td id="b" style="padding:0">B</td></tr></tbody><tfoot id="ft"><tr id="r3"><td id="c" style="padding:0">F</td></tr></tfoot></table></body></html>`, ['t', 'hd', 'bd', 'ft', 'r1', 'r2', 'r3', 'a', 'b', 'c']);

await browser.close();
