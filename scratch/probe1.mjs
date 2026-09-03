import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

async function evalHtml(html, fn) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(fn);
}

// 1. container-type computed serialization
console.log('--- 1. container-type computed serialization ---');
console.log(await evalHtml(
  `<style>
    #a { container-type: size; }
    #b { container-type: block-size; }
    #c { container-type: inline-size; }
  </style><div id="a">a</div><div id="b">b</div><div id="c">c</div>`,
  () => {
    const out = {};
    for (const id of ['a', 'b', 'c']) out[id] = getComputedStyle(document.getElementById(id)).containerType;
    return out;
  },
));

const M4 = `
    #m1 { color: black; } #m2 { color: black; } #m3 { color: black; } #m4 { color: black; }
    @container (min-width: 100px) { #m1 { color: rgb(255, 0, 0); } }
    @container (min-height: 100px) { #m2 { color: rgb(255, 0, 0); } }
    @container (inline-size: 200px) { #m3 { color: rgb(255, 0, 0); } }
    @container (block-size: 300px) { #m4 { color: rgb(255, 0, 0); } }`;

// 2. block-size container: which @container conditions match
console.log('--- 2. block-size container: which conditions match ---');
console.log(await evalHtml(
  `<style>body { margin: 0; }
    #wrap { container-type: block-size; height: 300px; width: 200px; background: #eee; } ${M4}</style>
  <div id="wrap"><div id="m1">m1</div><div id="m2">m2</div><div id="m3">m3</div><div id="m4">m4</div></div>`,
  () => {
    const out = {};
    for (const id of ['m1', 'm2', 'm3', 'm4']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 2b. size container: which axes
console.log('--- 2b. size container: which conditions match ---');
console.log(await evalHtml(
  `<style>body { margin: 0; }
    #wrap { container-type: size; height: 300px; width: 200px; background: #eee; } ${M4}</style>
  <div id="wrap"><div id="m1">m1</div><div id="m2">m2</div><div id="m3">m3</div><div id="m4">m4</div></div>`,
  () => {
    const out = {};
    for (const id of ['m1', 'm2', 'm3', 'm4']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 3. size containment: auto height of a size container with content
console.log('--- 3. size containment auto height ---');
console.log(await evalHtml(
  `<style>body { margin: 0; } #s { container-type: size; background: #fbb; } #s > div { height: 50px; background: #bfb; }</style>
   <div id="s"><div>inner</div></div>`,
  () => {
    const r = document.getElementById('s').getBoundingClientRect();
    return { w: r.width, h: r.height };
  },
));

// 3b. block-size containment auto height (if supported)
console.log('--- 3b. block-size containment auto height ---');
console.log(await evalHtml(
  `<style>body { margin: 0; } #s { container-type: block-size; background: #fbb; } #s > div { height: 50px; background: #bfb; }</style>
   <div id="s"><div>inner</div></div>`,
  () => {
    const r = document.getElementById('s').getBoundingClientRect();
    return { w: r.width, h: r.height };
  },
));

// 3c. inline-size containment control
console.log('--- 3c. inline-size containment auto height (control) ---');
console.log(await evalHtml(
  `<style>body { margin: 0; } #s { container-type: inline-size; background: #fbb; } #s > div { height: 50px; background: #bfb; }</style>
   <div id="s"><div>inner</div></div>`,
  () => {
    const r = document.getElementById('s').getBoundingClientRect();
    return { w: r.width, h: r.height };
  },
));

await browser.close();
