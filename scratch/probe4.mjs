import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

async function evalHtml(html, fn) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(fn);
}

// A. or-condition with mixed axes, inline-size-only chain
console.log('--- A. inline(200) only: (min-width:150px) or (min-height:999px) ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #w { container-type: inline-size; width: 200px; }
   #q { color: black; }
   @container (min-width: 150px) or (min-height: 999px) { #q { color: rgb(255,0,0); } }</style>
   <div id="w"><div id="q">q</div></div>`,
  () => getComputedStyle(document.getElementById('q')).color,
));

// B. not-condition with block feature, inline-size-only chain
console.log('--- B. inline(200) only: not (min-height: 999px) ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #w { container-type: inline-size; width: 200px; }
   #q { color: black; }
   @container not (min-height: 999px) { #q { color: rgb(255,0,0); } }</style>
   <div id="w"><div id="q">q</div></div>`,
  () => getComputedStyle(document.getElementById('q')).color,
));

// C. and-condition mixed axes with size outer + inline inner
console.log('--- C. size(600x400) > inline(200): (min-width:150px) and (min-height:50px) ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #o { container-type: size; width: 600px; height: 400px; }
   #i { container-type: inline-size; width: 200px; height: 100px; }
   #q { color: black; }
   @container (min-width: 150px) and (min-height: 50px) { #q { color: rgb(255,0,0); } }</style>
   <div id="o"><div id="i"><div id="q">q</div></div></div>`,
  () => getComputedStyle(document.getElementById('q')).color,
));

// D2. or-condition distinguishing strict per-condition vs per-feature
console.log('--- D2. size(100x400) > inline(200): (min-width:150px) or (min-height:999px) ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #o { container-type: size; width: 100px; height: 400px; }
   #i { container-type: inline-size; width: 200px; height: 100px; }
   #q { color: black; }
   @container (min-width: 150px) or (min-height: 999px) { #q { color: rgb(255,0,0); } }</style>
   <div id="o"><div id="i"><div id="q">q</div></div></div>`,
  () => getComputedStyle(document.getElementById('q')).color,
));

// E. supports parity
console.log('--- E. @supports container-type values ---');
console.log(await evalHtml(`<div id=x>x</div>`, () => ({
  size: CSS.supports('container-type: size'),
  inlineSize: CSS.supports('container-type: inline-size'),
  blockSize: CSS.supports('container-type: block-size'),
  normal: CSS.supports('container-type: normal'),
})));

// F. name-only query on inline-size container (control) + named size container block-axis query
console.log('--- F. name-only query + named size container ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #w { container: hero / size; width: 500px; height: 250px; }
   #q1 { color: black; } #q2 { color: black; }
   @container hero { #q1 { color: rgb(255,0,0); } }
   @container hero (block-size >= 250px) { #q2 { color: rgb(0,0,255); } }</style>
   <div id="w"><div id="q1">q1</div><div id="q2">q2</div></div>`,
  () => {
    const out = {};
    for (const id of ['q1', 'q2']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// G. cq units: does font-size cq affect line-height normal etc? and padding using cq
console.log('--- G. size container padding on container itself resolves against its own ancestors ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #o { container-type: size; width: 400px; height: 200px; }
   #c { container-type: inline-size; width: 10cqw; padding: 1cqw; }
   #c > div { height: 10px; background: rgb(0,255,0); }</style>
   <div id="o"><div id="c"><div></div></div></div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('c'));
    const r = document.getElementById('c').getBoundingClientRect();
    return { width: cs.width, paddingTop: cs.paddingTop, rectW: r.width, rectH: r.height };
  },
));

// H. percentage height inside size container + containment with percentage-height child
console.log('--- H. size container: pct-height child + overflow visible ---');
console.log(await evalHtml(
  `<style>body{margin:0}
   #s { container-type: size; height: 100px; background: rgb(255,0,0); }
   #s > div { height: 50%; background: rgb(0,255,0); }</style>
   <div id="s"><div>x</div></div>`,
  () => {
    const out = {};
    for (const id of ['s']) {
      const r = document.getElementById(id).getBoundingClientRect();
      out[id] = { w: r.width, h: r.height };
    }
    const c = document.getElementById('s').firstElementChild.getBoundingClientRect();
    out.child = { h: c.height };
    return out;
  },
));

await browser.close();
