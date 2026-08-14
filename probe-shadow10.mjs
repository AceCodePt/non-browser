import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const html = `<!doctype html><style>
#a { box-shadow: 2px 4px 6px 8px rgba(10,20,30,0.5); }
#b { box-shadow: inset 0px 2px 4px #0a66c2; }
#c { box-shadow: 0px 1px 2px red, 3px 4px 5px 6px blue; }
#d { box-shadow: none; }
#e { box-shadow: 2px 4px; }
#f { box-shadow: rgba(200, 100, 0, 0.3) 1px 1px; }
#g { text-shadow: 1px 2px 3px rgba(0,0,0,0.4); }
#h { text-shadow: none; }
#i { text-shadow: 0 0 4px #ff0000, 2px 2px 0 #00ff00; }
</style></head><body>
<div id="a"></div><div id="b"></div><div id="c"></div><div id="d"></div><div id="e"></div><div id="f"></div>
<div id="g">text</div><div id="h">text</div><div id="i">text</div></body>`;
await page.setContent(html);
for (const id of ['a','b','c','d','e','f','g','h','i']) {
  const r = await page.evaluate((id) => {
    const cs = getComputedStyle(document.getElementById(id));
    return { box: cs.getPropertyValue('box-shadow'), text: cs.getPropertyValue('text-shadow') };
  }, id);
  console.log(id, JSON.stringify(r));
}
// default value on plain div
const def = await page.evaluate(() => getComputedStyle(document.getElementById('d')).getPropertyValue('text-shadow'));
console.log('default text-shadow', JSON.stringify(def));
await browser.close();
