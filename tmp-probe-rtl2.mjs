import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });

async function probe(desc, cb, abs) {
  const html = `<div style="${cb};font-family:'Noto Sans';font-size:14px">
  <div id="a" style="position:absolute;height:20px;${abs}"></div>
</div>`;
  await page.setContent(html);
  const b = await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, y: r.y, h: r.height }; });
  const c = await page.$eval('#a', (el) => {
    const cs = getComputedStyle(el);
    return { left: cs.left, right: cs.right, top: cs.top, bottom: cs.bottom };
  });
  console.log(desc, 'rect', JSON.stringify(b), 'computed', JSON.stringify(c));
}

await probe('cb ltr pad0, abs 50w', 'position:relative;width:300px;height:100px;direction:ltr', 'width:50px');
await probe('cb rtl pad0, abs 50w', 'position:relative;width:300px;height:100px;direction:rtl', 'width:50px');
await probe('cb ltr pad10, abs 50w', 'position:relative;width:300px;height:100px;direction:ltr;padding:10px', 'width:50px');
await probe('cb rtl pad10, abs 50w', 'position:relative;width:300px;height:100px;direction:rtl;padding:10px', 'width:50px');
await probe('cb rtl pad0, abs 50w margin-left 0', 'position:relative;width:300px;height:100px;direction:rtl', 'width:50px;margin-left:0');
await probe('cb rtl pad0, abs width auto', 'position:relative;width:300px;height:100px;direction:rtl', '');

// static position against padded CB, more detail
await probe('cb rtl pad20, abs 50w', 'position:relative;width:300px;height:100px;direction:rtl;padding:20px', 'width:50px');
await probe('cb ltr pad20, abs 50w', 'position:relative;width:300px;height:100px;direction:ltr;padding:20px', 'width:50px');

// flex/static inside a padded rtl CB with a preceding in-flow item
await page.setContent(`<div style="position:relative;width:300px;height:100px;direction:rtl;padding:0px">
  <div style="width:120px;height:20px;background:#ddd"></div>
  <div id="a" style="position:absolute;width:50px;height:20px;background:red"></div>
</div>`);
console.log('rtl abs after an in-flow block:', JSON.stringify(await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width }; })));

await page.setContent(`<div style="position:relative;width:300px;height:100px;direction:ltr;padding:0px">
  <div style="width:120px;height:20px;background:#ddd"></div>
  <div id="a" style="position:absolute;width:50px;height:20px;background:red"></div>
</div>`);
console.log('ltr abs after an in-flow block:', JSON.stringify(await page.$eval('#a', (el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width }; })));

await browser.close();