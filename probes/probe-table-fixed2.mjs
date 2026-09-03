#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function cols(name, html) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('td, th')];
    const t = document.querySelector('table');
    return {
      table: (() => { const b = t.getBoundingClientRect(); return { x: +b.x.toFixed(3), y: +b.y.toFixed(3), width: +b.width.toFixed(3), height: +b.height.toFixed(3) }; })(),
      cells: cells.map((c) => { const b = c.getBoundingClientRect(); return [+b.x.toFixed(3), +b.y.toFixed(3), +b.width.toFixed(3), +b.height.toFixed(3)]; }),
    };
  });
  console.log(name, JSON.stringify(r));
}

const S = 'border-collapse:separate;border-spacing:0';

// fixed layout: specified + auto
await cols('fixed-between', `${H}<table style="width:300px;table-layout:fixed;${S}"><tr><td style="padding:0;width:100px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
await cols('fixed-less-min', `${H}<table style="width:300px;table-layout:fixed;${S}"><tr><td style="padding:0;width:30px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
await cols('fixed-more-max', `${H}<table style="width:300px;table-layout:fixed;${S}"><tr><td style="padding:0;width:200px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
await cols('fixed-shrink', `${H}<table style="width:120px;table-layout:fixed;${S}"><tr><td style="padding:0;width:100px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
await cols('fixed-shrink2', `${H}<table style="width:150px;table-layout:fixed;${S}"><tr><td style="padding:0;width:60px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// two specified columns, over/under
await cols('fixed-two-spec-over', `${H}<table style="width:120px;table-layout:fixed;${S}"><tr><td style="padding:0;width:100px">A</td><td style="padding:0;width:100px">B</td></tr></table></body></html>`);
await cols('fixed-two-spec-under', `${H}<table style="width:300px;table-layout:fixed;${S}"><tr><td style="padding:0;width:100px">A</td><td style="padding:0;width:100px">B</td></tr></table></body></html>`);
// two auto columns only
await cols('fixed-two-auto', `${H}<table style="width:300px;table-layout:fixed;${S}"><tr><td style="padding:0">AAAA</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// fixed with long text overflow: does text wrap or overflow?
await cols('fixed-wrap', `${H}<table style="width:60px;table-layout:fixed;${S}"><tr><td style="padding:0;width:30px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// no specified widths at all, auto width table
await cols('fixed-auto-table', `${H}<table style="table-layout:fixed;${S}"><tr><td style="padding:0">AAAA</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// col elements in fixed
await cols('fixed-cols', `${H}<table style="width:300px;table-layout:fixed;${S}"><colgroup><col style="width:80px"><col style="width:40%"></colgroup><tr><td style="padding:0">AAAA</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// percent cells in fixed
await cols('fixed-pct-cells', `${H}<table style="width:300px;table-layout:fixed;${S}"><tr><td style="padding:0;width:25%">AAAA</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// auto layout: min-content shrink with multi columns
await cols('auto-shrink-mixed', `${H}<table style="width:60px;${S}"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`);
// auto layout: percent + auto where pct > content
await cols('auto-pct-wide', `${H}<table style="width:300px;${S}"><tr><td style="padding:0;width:80%">AAAA</td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// auto layout with constrained cell and long second row
await cols('auto-two-rows', `${H}<table style="width:300px;${S}"><tr><td style="padding:0;width:100px">AAAA</td><td style="padding:0">B</td></tr><tr><td style="padding:0">longer text here</td><td style="padding:0">B</td></tr></table></body></html>`);
// empty cells / no cells
await cols('empty-rows', `${H}<table style="${S}"><tr id="r1"><td style="padding:0"></td><td style="padding:0">BBBB</td></tr></table></body></html>`);
// row heights with specified height smaller than content
await cols('row-height-clamp', `${H}<table style="${S}"><tr id="r1" style="height:5px"><td style="padding:0;height:10px">A<br>B</td></tr></table></body></html>`);
// rowspan spanning 3 rows with excess
await cols('rowspan-3', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="3">A<br>B<br>C<br>D<br>E<br>F</td><td style="padding:0">one</td></tr><tr><td style="padding:0">two</td></tr><tr><td style="padding:0">three</td></tr></table></body></html>`);
// caption with 2 columns and spacing
await cols('caption-2col', `${H}<table style="border-spacing:4px"><caption style="margin:0;padding:0">Caption text</caption><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td></tr></table></body></html>`);

await browser.close();
