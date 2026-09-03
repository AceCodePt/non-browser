#!/usr/bin/env node
// Over-constrained fixed layout: what does chrome do with spec 50+80 in width:100?
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const H = '<style>html,body{margin:0;padding:0;font-family:\'Noto Sans\';font-size:16px}</style>';
const S = 'border-collapse:separate;border-spacing:0;';

async function cols(name, html) {
  await page.setContent(`<!doctype html><html><head>${H}</head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(() => [...document.querySelectorAll('td')].map((el) => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(4), +r.width.toFixed(4)]; }));
  const widths = r.map(([, w]) => w);
  console.log(name, 'x=' + r.map(([x]) => x).join(','), 'w=' + widths.join(','), 'sum=' + widths.reduce((a, b) => a + b, 0).toFixed(4));
}

// spacing 0, assignable 100
await cols('sp0-empty', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px"></td><td style="padding:0;width:80px"></td></tr></table>`);
await cols('sp0-AB', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">A</td><td style="padding:0;width:80px">B</td></tr></table>`);
await cols('sp0-narrow', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">n</td><td style="padding:0;width:80px">n</td></tr></table>`);
await cols('sp0-wide-small', `${H}<table style="${S}table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">nnnnnnnnnnnnnnnnnnnnnnnnnnnnnn</td><td style="padding:0;width:80px">n</td></tr></table>`);
// spacing 2, assignable 94
await cols('sp2-AB', `${H}<table style="border-collapse:separate;table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px">A</td><td style="padding:0;width:80px">B</td></tr></table>`);
await cols('sp2-empty', `${H}<table style="border-collapse:separate;table-layout:fixed;width:100px"><tr><td style="padding:0;width:50px"></td><td style="padding:0;width:80px"></td></tr></table>`);
await browser.close();
