import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 220 } });
const html = `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:$_"><div id="k" style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`;
for (const ov of ['hidden', 'clip', 'auto']) {
  await page.setContent(html.replace('$_', ov));
  const cs = await page.evaluate(() => {
    const el = document.getElementById('k');
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const shot = await page.screenshot();
  writeFileSync(`/tmp/opencode/ov-${ov}.png`, shot);
  console.log(ov, 'child rect relative to parent content box:', JSON.stringify(cs));
}
await page.close();
await browser.close();
