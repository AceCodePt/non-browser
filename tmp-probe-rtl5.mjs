import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 400 } });

async function blockw(desc, innerCss, dir) {
  await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="box-sizing:border-box;width:300px;direction:${dir};height:20px">
  <div id="b" style="box-sizing:border-box;height:10px;${innerCss}"></div>
</div>`);
  const r = await page.$eval('#b', (el) => {
    const b = el.getBoundingClientRect();
    const c = getComputedStyle(el);
    return { x: b.x, w: b.width, ml: c.marginLeft, mr: c.marginRight };
  });
  console.log(`${desc}:`, JSON.stringify(r));
}

await blockw('ltr w:150 m:0', 'width:150px', 'ltr');
await blockw('rtl w:150 m:0', 'width:150px', 'rtl');
await blockw('ltr w:150 ml:auto', 'width:150px;margin-left:auto', 'ltr');
await blockw('rtl w:150 ml:auto', 'width:150px;margin-left:auto', 'rtl');
await blockw('ltr w:150 mr:auto', 'width:150px;margin-right:auto', 'ltr');
await blockw('rtl w:150 mr:auto', 'width:150px;margin-right:auto', 'rtl');
await blockw('ltr w:150 m:auto', 'width:150px;margin:0 auto', 'ltr');
await blockw('rtl w:150 m:auto', 'width:150px;margin:0 auto', 'rtl');
await blockw('ltr w:150 ml:10', 'width:150px;margin-left:10px', 'ltr');
await blockw('rtl w:150 ml:10', 'width:150px;margin-left:10px', 'rtl');

// ltr child in rtl container (own direction ltr)
await page.setContent(`<style>html,body{margin:0;padding:0}</style><div style="width:300px;direction:rtl">
  <p id="b" style="direction:ltr;width:150px;margin:0;height:10px"></p>
</div>`);
console.log('ltr-width block inside rtl CB:', JSON.stringify(await page.$eval('#b', (el) => { const b = el.getBoundingClientRect(); return { x: b.x, w: b.width }; })));

// auto cross / abs within shrink
await browser.close();