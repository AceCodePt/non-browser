import { chromium } from 'playwright';
import { decodePng } from '../dist/harness/png.js';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 220 } });
const html = `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:$_"><div id="k" style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`;
for (const ov of ['hidden', 'clip', 'auto', 'visible']) {
  await page.setContent(html.replace('$_', ov));
  const shot = await page.screenshot();
  const png = decodePng(shot);
  const red = [];
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const o = (y * png.width + x) * 4;
      if (png.data[o] === 224 && png.data[o+1] === 96 && png.data[o+2] === 64) red.push({ x, y });
    }
  }
  const minX = Math.min(...red.map(p => p.x)), maxX = Math.max(...red.map(p => p.x));
  const minY = Math.min(...red.map(p => p.y)), maxY = Math.max(...red.map(p => p.y));
  console.log(`${ov}: red bbox x=[${minX},${maxX}] y=[${minY},${maxY}] count=${red.length}`);
}
await page.close();
await browser.close();
