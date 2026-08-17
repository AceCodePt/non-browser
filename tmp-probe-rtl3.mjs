import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;width:50px;height:20px;margin-left:10px"></div>
</div>`);
const m = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right, ml: c.marginLeft, mr: c.marginRight }; });
console.log('rtl static, margin-left:10 →', JSON.stringify(m));

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;width:50px;height:20px;margin-right:10px"></div>
</div>`);
const m2 = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right, ml: c.marginLeft, mr: c.marginRight }; });
console.log('rtl static, margin-right:10 →', JSON.stringify(m2));

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;width:50px;height:20px;margin-left:auto;margin-right:auto"></div>
</div>`);
const m3 = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right, ml: c.marginLeft, mr: c.marginRight }; });
console.log('rtl static, margins auto →', JSON.stringify(m3));

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;left:10px;top:0;right:auto;width:50px;height:20px"></div>
</div>`);
const m4 = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right }; });
console.log('rtl left:10 (+right auto) →', JSON.stringify(m4));

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;right:10px;top:0;left:auto;width:50px;height:20px"></div>
</div>`);
const m5 = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right }; });
console.log('rtl right:10 (+left auto) →', JSON.stringify(m5));

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;inset-inline-start:10px;width:50px;height:20px"></div>
</div>`);
const m6 = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right }; });
console.log('rtl inset-inline-start:10 →', JSON.stringify(m6));

await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="position:relative;width:300px;height:100px;direction:rtl;border:0">
  <div id="a" style="position:absolute;inset-inline-end:10px;width:50px;height:20px"></div>
</div>`);
const m7 = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: r.x, w: r.width, left: c.left, right: c.right }; });
console.log('rtl inset-inline-end:10 →', JSON.stringify(m7));

// e of a plain paragraph in rtl (text-align initial)
await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="width:300px;direction:rtl;font-family:'Noto Sans';font-size:14px;line-height:20px">
  <p id="p" style="margin:0;color:red">שלום</p>
</div>`);
console.log('rtl p', JSON.stringify(await page.$eval('#p', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width }; })));

await browser.close();