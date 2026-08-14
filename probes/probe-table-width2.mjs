#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 200 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function cols(html) {
  await page.setContent(html);
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('td')];
    return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
  });
}

// min/max content: no table width
console.log('auto:', await cols(`${H}<table style="border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`));

// distribute extra: table 300
console.log('300:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`));

// with padding (default 1px each side via UA):
console.log('300-pad1:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td>A</td><td>BBBB</td><td>C</td></tr></table></body></html>`));

// table width between min and max: table 80 with multiword
console.log('80-multi:', await cols(`${H}<table style="width:80px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">longer text here</td><td style="padding:0">C</td></tr></table></body></html>`));

// table width 40 (below min-content sum): 
console.log('40-multi:', await cols(`${H}<table style="width:40px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">longer text here</td><td style="padding:0">C</td></tr></table></body></html>`));

// table 300, multiword cell + span distribution check
console.log('300-multi:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">longer text here longer text here</td><td style="padding:0">C</td></tr></table></body></html>`));

// colspan with known widths: spanning cell
console.log('colspan-auto:', await cols(`${H}<table style="border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td></tr><tr><td colspan="2" style="padding:0">CCCCCCCCCC</td></tr></table></body></html>`));

// colspan table 300: spanning cell distributes
console.log('colspan-300:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0">A</td><td style="padding:0">BBBB</td></tr><tr><td colspan="2" style="padding:0">CCCCCCCCCC</td></tr></table></body></html>`));

// rowspan heights
console.log('rowspan:', await page.evaluate(async () => { return []; }));

// 3 cols where one has explicit px width
console.log('fixed-col:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:40px">A</td><td style="padding:0">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`));

// percentage: 25/75
console.log('pct-300:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">A</td><td style="padding:0;width:75%">BBBB</td></tr></table></body></html>`));

await browser.close();
