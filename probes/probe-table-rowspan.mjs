#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const H = '<html><head><style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style></head><body>';
const S = 'border-collapse:separate;border-spacing:0';

async function rows(name, html) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => [...document.querySelectorAll('tr')].map((tr) => +tr.getBoundingClientRect().height.toFixed(3)));
  console.log(name, JSON.stringify(r));
}

// A: spanner rows0-2 min132, spanner rows1-2 min88  (observed [22,22,88])
await rows('A', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="3">A<br>B<br>C<br>D<br>E<br>F</td><td style="padding:0">one</td></tr><tr><td style="padding:0" rowspan="2">x<br>y<br>z<br>w</td></tr><tr><td style="padding:0">three</td></tr></table></body></html>`);

// B: spanner rows0-1 min132 (6 lines), spanner rows1-2 min44 (2 lines)
await rows('B', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="2">A<br>B<br>C<br>D<br>E<br>F</td><td style="padding:0">one</td></tr><tr><td style="padding:0" rowspan="2">x<br>y</td></tr><tr><td style="padding:0">three</td></tr></table></body></html>`);

// C: unequal bases [22,44], single spanner rows0-1 min132
await rows('C', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="2">A<br>B<br>C<br>D<br>E<br>F</td><td style="padding:0">one</td></tr><tr><td style="padding:0">two<br>lines</td></tr></table></body></html>`);

// D: spanner rows0-2 min132, spanner rows2-3 min88 (4 rows)
await rows('D', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="3">A<br>B<br>C<br>D<br>E<br>F</td><td style="padding:0">one</td></tr><tr><td style="padding:0">two</td></tr><tr><td style="padding:0" rowspan="2">x<br>y<br>z<br>w</td></tr><tr><td style="padding:0">four</td></tr></table></body></html>`);

// E: spanner rows0-1 min132, spanner rows0-2 min88
await rows('E', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="2">A<br>B<br>C<br>D<br>E<br>F</td><td style="padding:0" rowspan="3">x<br>y<br>z<br>w</td><td style="padding:0">one</td></tr><tr><td style="padding:0">two</td></tr><tr><td style="padding:0">three</td></tr></table></body></html>`);

// F: three single-line rows, one spanner rows0-2 min 88 (4 lines: excess 22)
await rows('F', `${H}<table style="${S}"><tr><td style="padding:0" rowspan="3">A<br>B<br>C<br>D</td><td style="padding:0">one</td></tr><tr><td style="padding:0">two</td></tr><tr><td style="padding:0">three</td></tr></table></body></html>`);

await browser.close();
