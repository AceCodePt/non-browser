import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

async function evalHtml(html, fn) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(fn);
}

// 4. cq units: resolution against nearest container content-box
console.log('--- 4. cq units vs container content-box (padding 10, border 5) ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: size; width: 400px; height: 200px; padding: 10px; border: 5px solid black; background: #eee; }
    #w { width: 10cqw; height: 10cqh; font-size: 10cqw; }
    #i { width: 10cqi; height: 10cqb; }
    #min { width: 10cqmin; } #max { width: 10cqmax; }
  </style>
  <div id="wrap">
    <div id="w">w</div><div id="i">i</div><div id="min">min</div><div id="max">max</div>
  </div>`,
  () => {
    const out = {};
    for (const id of ['w', 'i', 'min', 'max']) {
      const cs = getComputedStyle(document.getElementById(id));
      out[id] = { width: cs.width, height: cs.height, fontSize: cs.fontSize };
    }
    return out;
  },
));

// 4b. cq units without a container (fallback)
console.log('--- 4b. cq units with no container (800x600 viewport) ---');
console.log(await evalHtml(
  `<style>body { margin: 0; } #w { width: 10cqw; height: 10cqh; font-size: 10cqw; }</style><div id="w">w</div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('w'));
    return { width: cs.width, height: cs.height, fontSize: cs.fontSize };
  },
));

// 4c. nested containers: cq unit picks nearest
console.log('--- 4c. nested containers: cq units pick nearest ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #outer { container-type: size; width: 800px; height: 400px; }
    #inner { container-type: size; width: 200px; height: 100px; }
    #q { width: 10cqw; height: 10cqh; }
  </style>
  <div id="outer"><div id="inner"><div id="q">q</div></div></div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('q'));
    return { width: cs.width, height: cs.height };
  },
));

// 5. size container with auto height: what does a min-height query see?
console.log('--- 5. size container auto height queried ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: size; width: 400px; background: #eee; }
    #m1 { color: black; } #m2 { color: black; }
    @container (min-height: 0px) { #m1 { color: rgb(255, 0, 0); } }
    @container (min-height: 1px) { #m2 { color: rgb(255, 0, 0); } }
  </style>
  <div id="wrap"><div id="m1">m1</div><div id="m2">m2</div></div>`,
  () => {
    const out = {};
    for (const id of ['m1', 'm2']) out[id] = getComputedStyle(document.getElementById(id)).color;
    const r = document.getElementById('wrap').getBoundingClientRect();
    out.wrapRect = { w: r.width, h: r.height };
    return out;
  },
));

// 6. does an inline-size container support height/block-size queries? (spec: unknown axis -> unknown)
console.log('--- 6. inline-size container: height queries match or not? ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: inline-size; width: 400px; height: 300px; background: #eee; }
    #m1 { color: black; } #m2 { color: black; }
    @container (min-height: 100px) { #m1 { color: rgb(255, 0, 0); } }
    @container (block-size: 300px) { #m2 { color: rgb(255, 0, 0); } }
  </style>
  <div id="wrap"><div id="m1">m1</div><div id="m2">m2</div></div>`,
  () => {
    const out = {};
    for (const id of ['m1', 'm2']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 7. inline-size container: cq units resolve height against what?
console.log('--- 7. inline-size container: cqh resolves against what? ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: inline-size; width: 400px; height: 300px; background: #eee; }
    #q { width: 10cqw; height: 10cqh; }
  </style>
  <div id="wrap"><div id="q">q</div></div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('q'));
    return { width: cs.width, height: cs.height };
  },
));

// 8. container shorthand + container-name computed serialization
console.log('--- 8. container-name serialization ---');
console.log(await evalHtml(
  `<style>
    #a { container-name: sidebar main; container-type: inline-size; }
    #b { container: hero / inline-size; }
    #c { container: 400px / size; }
  </style><div id="a">a</div><div id="b">b</div><div id="c">c</div>`,
  () => {
    const out = {};
    for (const id of ['a', 'b', 'c']) {
      const cs = getComputedStyle(document.getElementById(id));
      out[id] = { containerName: cs.containerName, containerType: cs.containerType };
    }
    return out;
  },
));

// 9. named container + cq units against named container? (cq units always use nearest container regardless of name)
console.log('--- 9. cq units: nearest unnamed container vs named ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #named { container-name: hero; container-type: size; width: 600px; height: 300px; }
    #plain { container-type: size; width: 300px; height: 150px; }
    #q { width: 10cqw; height: 10cqh; }
  </style>
  <div id="named"><div id="plain"><div id="q">q</div></div></div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('q'));
    return { width: cs.width, height: cs.height };
  },
));

await browser.close();
