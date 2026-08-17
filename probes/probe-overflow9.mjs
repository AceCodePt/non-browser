import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 220 } });
// rounded + transparent border: check whether red bleeds into the border ring (border-box clip) or stops at padding box
const html = `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;border:20px solid rgba(0,0,0,0);border-radius:24px;overflow:$_"><div id="k" style="width:200px;height:120px;background:#e06040;margin-left:60px;margin-top:50px"></div></div>`;
for (const ov of ['hidden', 'clip']) {
  await page.setContent(html.replace('$_', ov));
  const shot = await page.screenshot();
  const png = decodePng(shot);
  const xs = new Set(), ys = new Set();
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const o = (y * png.width + x) * 4;
    if (png.data[o] === 224 && png.data[o+1] === 96 && png.data[o+2] === 64) { xs.add(x); ys.add(y); }
  }
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  console.log(`${ov}: red bbox x=[${minX},${maxX}] y=[${minY},${maxY}] count=${xs.size * ys.size}`);
}
await page.close();
await browser.close();
