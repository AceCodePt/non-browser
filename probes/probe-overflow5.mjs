import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 220 } });
const html = `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;overflow:$_"><div id="k" style="width:200px;height:120px;background:#e06040;margin-left:40px;margin-top:30px"></div></div>`;
for (const ov of ['hidden', 'clip', 'auto', 'visible']) {
  await page.setContent(html.replace('$_', ov));
  const info = await page.evaluate(() => {
    const c = document.getElementById('c');
    const k = document.getElementById('k');
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { c: r(c), k: r(k), parentOverflow: getComputedStyle(c).overflow };
  });
  console.log(ov, JSON.stringify(info));
}
await page.close();
await browser.close();
