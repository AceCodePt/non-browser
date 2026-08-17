import { chromium } from 'playwright';

const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0}</style></head><body>
<div id="root" style="position:relative;width:400px;height:300px;font-family:'Noto Sans';font-size:14px;line-height:20px">
  <div id="margins" style="direction:rtl;width:200px;margin-inline-start:30px;padding-inline-start:5px"></div>
  <div id="abs-static" style="direction:rtl;position:absolute;width:100px;height:20px;background:red"></div>
  <div id="abs-r" style="position:absolute;width:100px;height:20px;right:20px;background:blue"></div>
  <div id="abs-inline-start" style="position:absolute;width:100px;height:20px;inset-inline-start:20px;background:green"></div>
  <div id="text-start" style="direction:rtl;text-align:start;width:200px">שלום עולם אב גד</div>
  <div id="text-start-ltr" style="text-align:start;width:200px">hello world foo</div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);

for (const id of ['margins', 'abs-static', 'abs-r', 'abs-inline-start', 'text-start', 'text-start-ltr']) {
  const r = await page.$eval(`#${id}`, (el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  console.log(id, JSON.stringify(r));
}

// static position in RTL with containing block padding
const r2 = await page.evaluate(() => {
  const b = document.getElementById('abs-static').getBoundingClientRect();
  return b.x;
});
console.log('abs-static x:', r2);

// abs with insets: left:auto right:auto inside padding CB
await page.setContent(`<div style="padding:10px;position:relative;width:200px;height:100px;direction:rtl">
  <div id="a" style="position:absolute;width:50px;height:20px"></div>
</div>`);
console.log('rtl abs static (inside padded CB):', JSON.stringify(await page.$eval('#a', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

await page.setContent(`<div style="padding:10px;position:relative;width:200px;height:100px;direction:ltr">
  <div id="a" style="position:absolute;width:50px;height:20px"></div>
</div>`);
console.log('ltr abs static (inside padded CB):', JSON.stringify(await page.$eval('#a', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

// over-constrained: left+right+margin set
await page.setContent(`<div style="position:relative;width:300px;height:50px;direction:rtl">
  <div id="a" style="position:absolute;left:10px;right:20px;margin:0;width:150px;height:10px"></div>
</div>`);
console.log('rtl over-constrained (left+right set):', JSON.stringify(await page.$eval('#a', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));
await page.setContent(`<div style="position:relative;width:300px;height:50px;direction:ltr">
  <div id="a" style="position:absolute;left:10px;right:20px;margin:0;width:150px;height:10px"></div>
</div>`);
console.log('ltr over-constrained (left+right set):', JSON.stringify(await page.$eval('#a', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

// relative inset-inline-start
await page.setContent(`<div style="position:relative;width:100px;height:20px;direction:rtl">
  <div style="position:relative;width:50px;height:10px;background:#eee"></div>
  <div id="a" style="position:relative;width:50px;height:10px;inset-inline-start:15px"></div>
</div>`);
console.log('rtl relative inset-inline-start:', JSON.stringify(await page.$eval('#a', (el) => { const b = el.getBoundingClientRect(); return { x: b.x }; })));

// float inline-start
await page.setContent(`<div style="width:200px;direction:rtl;font-size:0">
  <div id="f" style="float:inline-start;width:60px;height:30px;background:red"></div>
  <span id="s" style="display:inline-block;width:10px;height:10px"></span>
</div>`);
console.log('rtl float:inline-start:', JSON.stringify(await page.$eval('#f', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

// grid rtl
await page.setContent(`<div style="display:grid;grid-template-columns:80px 120px;width:300px;direction:rtl">
  <div id="g1" style="background:red;height:20px"></div>
  <div id="g2" style="background:blue;height:20px"></div>
</div>`);
for (const id of ['g1', 'g2']) {
  console.log(id, JSON.stringify(await page.$eval(`#${id}`, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));
}

// grid justify-content end
await page.setContent(`<div style="display:grid;grid-template-columns:80px 80px;width:260px;direction:rtl;justify-content:end">
  <div id="g1" style="background:red;height:20px"></div>
  <div id="g2" style="background:blue;height:20px"></div>
</div>`);
for (const id of ['g1', 'g2']) {
  console.log('jc-end', id, JSON.stringify(await page.$eval(`#${id}`, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));
}

// flex rtl row
await page.setContent(`<div style="display:flex;width:300px;direction:rtl">
  <div id="f1" style="width:80px;height:20px;background:red"></div>
  <div id="f2" style="width:80px;height:20px;background:blue"></div>
</div>`);
for (const id of ['f1', 'f2']) {
  console.log(id, JSON.stringify(await page.$eval(`#${id}`, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));
}

// flex row-reverse + rtl
await page.setContent(`<div style="display:flex;flex-direction:row-reverse;width:300px;direction:rtl">
  <div id="f1" style="width:80px;height:20px;background:red"></div>
  <div id="f2" style="width:80px;height:20px;background:blue"></div>
</div>`);
for (const id of ['f1', 'f2']) {
  console.log('row-reverse rtl', id, JSON.stringify(await page.$eval(`#${id}`, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));
}

// flex rtl justify-content:flex-end
await page.setContent(`<div style="display:flex;width:300px;direction:rtl;justify-content:flex-end">
  <div id="f1" style="width:80px;height:20px;background:red"></div>
  <div id="f2" style="width:80px;height:20px;background:blue"></div>
</div>`);
for (const id of ['f1', 'f2']) {
  console.log('rtl jc-end', id, JSON.stringify(await page.$eval(`#${id}`, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));
}

// flex row rtl - column direction effect on cross margins
await page.setContent(`<div style="display:flex;flex-direction:column;width:300px;direction:rtl">
  <div id="f1" style="width:80px;height:20px;background:red"></div>
</div>`);
console.log('column rtl', JSON.stringify(await page.$eval('#f1', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

// block margin-inline-start in rtl for static-position-independent case
await page.setContent(`<div style="width:400px;direction:rtl">
  <div id="b1" style="margin:0;width:100px;height:20px"></div>
</div>`);
console.log('rtl block child', JSON.stringify(await page.$eval('#b1', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

// row-reverse in rtl == ltr row
await page.setContent(`<div style="display:flex;flex-direction:row;width:300px;direction:ltr">
  <div id="f1" style="width:80px;height:20px;background:red"></div>
</div>`);
console.log('ltr row', JSON.stringify(await page.$eval('#f1', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

await browser.close();