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

// percent between min and max content
console.log('pct-between:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:25%">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// fixed between min and max content
console.log('fixed-between:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:100px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// fixed less than min-content, auto col
console.log('fixed-less-min:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:30px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// fixed greater than max-content
console.log('fixed-more-max:', await cols(`${H}<table style="width:300px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:200px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// shrink with fixed col between min and max: table 120, fixed 100
console.log('shrink-fixed:', await cols(`${H}<table style="width:120px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:100px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

// fixed 60 with content 120 max: table 150
console.log('shrink-fixed2:', await cols(`${H}<table style="width:150px;border-collapse:separate;border-spacing:0"><tr><td style="padding:0;width:60px">longer text here</td><td style="padding:0">BBBB</td></tr></table></body></html>`));

await browser.close();
