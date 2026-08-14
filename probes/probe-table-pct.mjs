#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 300 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';

async function cols(html) {
  await page.setContent(html);
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('td')];
    return cells.map((c) => { const b = c.getBoundingClientRect(); return +b.width.toFixed(3); });
  });
}

// percent col with content wider than its percentage
console.log('pct-content-wider:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">CCCCCCCCCC</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// percent + auto + fixed mix
console.log('pct-fixed-auto:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">A</td><td style="padding:0;width:50px">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`));

// percent column shrink: table narrow
console.log('pct-shrink:', await cols(`${H}<table style="width:100px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// percent 25% + auto, content tiny, extra distribution to auto
console.log('pct-tiny:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">A</td><td style="padding:0">A</td><td style="padding:0">A</td></tr></table></body></html>`));

// two percent columns that sum < 100%
console.log('pct-two:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">A</td><td style="padding:0;width:25%">BBBB</td><td style="padding:0">C</td></tr></table></body></html>`));

// auto table: percent + auto
console.log('pct-auto-table:', await cols(`${H}<table style="border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">A</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// empty table / empty cells
console.log('empty-cells:', await cols(`${H}<table style="width:200px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0"></td><td style="padding:0;width:80px"></td></tr></table></body></html>`));

await browser.close();
