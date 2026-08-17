import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 220 } });
const html = `<div id="c" style="position:relative;left:10px;top:10px;width:120px;height:80px;background:#f0f0f0;border:20px solid #444;overflow:$_"><div id="k" style="width:200px;height:120px;background:#e06040;margin-left:60px;margin-top:50px"></div></div>`;
for (const ov of ['hidden', 'clip', 'auto']) {
  await page.setContent(html.replace('$_', ov));
  const info = await page.evaluate(() => {
    const c = document.getElementById('c');
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { c: r(c), k: r(document.getElementById('k')) };
  });
  console.log(ov, JSON.stringify(info));
}
await page.close();
await browser.close();
