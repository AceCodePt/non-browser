import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });

await page.setContent(`<style>html,body{margin:0}</style><div style="width:200px;direction:rtl;font-family:'Noto Sans';font-size:14px">
  <div id="f" style="float:inline-start;width:60px;height:30px;background:red"></div>
  <div id="c" style="clear:inline-start;width:50px;height:10px;background:blue"></div>
</div>`);
const fc = await page.$eval('#f', (el) => getComputedStyle(el).float);
const cc = await page.$eval('#c', (el) => getComputedStyle(el).clear);
const fr = await page.$eval('#f', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; });
const cr = await page.$eval('#c', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width }; });
console.log('float inline-start (rtl): computed', fc, 'rect', JSON.stringify(fr), 'clear computed', cc, 'clear rect', JSON.stringify(cr));

await page.setContent(`<style>html,body{margin:0}</style><div style="width:200px;direction:ltr">
  <div id="f" style="float:inline-start;width:60px;height:30px;background:red"></div>
</div>`);
const fr2 = await page.$eval('#f', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; });
console.log('float inline-start (ltr):', JSON.stringify(fr2));

await page.setContent(`<style>html,body{margin:0}</style><div id="d" style="direction:rtl;width:100px"></div>`);
const d = await page.$eval('#d', (el) => getComputedStyle(el).direction);
console.log('computed direction:', d);

// text-align:start computed and used in rtl
await page.setContent(`<style>html,body{margin:0}</style><div style="width:200px;direction:rtl;font-family:'Noto Sans';font-size:14px">
  <div id="t" style="text-align:start;width:200px">abc</div>
</div>`);
const t = await page.$eval('#t', (el) => { const c = getComputedStyle(el); const r = document.createRange(); r.selectNodeContents(el); const frag = r.getClientRects(); return { ta: c.textAlign, frags: Array.from(frag, (f) => ({ x: f.x, w: f.width })) }; });
console.log('rtl text-align:start → computed', t.ta, 'fragments', JSON.stringify(t.frags));

// inline-start margin on a float in rtl
await page.setContent(`<style>html,body{margin:0}</style><div style="width:300px;direction:rtl">
  <div id="f" style="float:inline-start;width:60px;height:30px;margin-inline-start:10px;background:red"></div>
</div>`);
const fr3 = await page.$eval('#f', (el) => { const b = el.getBoundingClientRect(); const c = getComputedStyle(el); return { x: b.x, w: b.width, ml: c.marginLeft, mr: c.marginRight, f: c.float }; });
console.log('rtl float inline-start + margin-inline-start:10 →', JSON.stringify(fr3));

// nbsp: does direction inherit into widths / does p margin-inline behavior
await page.setContent(`<style>html,body{margin:0}</style><div style="width:300px;direction:rtl">
  <p id="p" style="margin:0;width:150px;direction:ltr;background:#eee">ltr inside rtl</p>
  <p id="q" style="margin:0;width:150px;background:#ddd">rtl auto</p>
</div>`);
for (const id of ['p', 'q']) {
  const r = await page.$eval(`#${id}`, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; });
  console.log(id, JSON.stringify(r));
}

await browser.close();