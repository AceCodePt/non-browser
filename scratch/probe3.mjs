import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

async function evalHtml(html, fn) {
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(fn);
}

// 10. per-axis cq unit selection: size outer + inline-size inner
console.log('--- 10. cq units: size(outer 600x400) > inline-size(inner 200) ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #outer { container-type: size; width: 600px; height: 400px; }
    #inner { container-type: inline-size; width: 200px; height: 100px; }
    #q { width: 10cqw; height: 10cqh; }
  </style>
  <div id="outer"><div id="inner"><div id="q">q</div></div></div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('q'));
    return { width: cs.width, height: cs.height };
  },
));

// 10b. mixed selection in @container conditions: min-height on inline-size inner skips to size outer?
console.log('--- 10b. condition (min-height: 300px): inner inline-size skipped, outer size selected ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #outer { container-type: size; width: 600px; height: 400px; }
    #inner { container-type: inline-size; width: 200px; height: 100px; }
    #q1 { color: black; } #q2 { color: black; } #q3 { color: black; }
    @container (min-height: 300px) { #q1 { color: rgb(255, 0, 0); } }
    @container (min-width: 150px) { #q2 { color: rgb(0, 255, 0); } }
    @container (aspect-ratio: 3/2) { #q3 { color: rgb(0, 0, 255); } }
  </style>
  <div id="outer"><div id="inner">
    <div id="q1">q1</div><div id="q2">q2</div><div id="q3">q3</div>
  </div></div>`,
  () => {
    const out = {};
    for (const id of ['q1', 'q2', 'q3']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 10c. aspect-ratio and orientation on inline-size container only (no outer size container)
console.log('--- 10c. aspect-ratio/orientation on inline-size-only container ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: inline-size; width: 400px; height: 200px; }
    #q1 { color: black; } #q2 { color: black; }
    @container (aspect-ratio: 2/1) { #q1 { color: rgb(255, 0, 0); } }
    @container (orientation: landscape) { #q2 { color: rgb(0, 0, 255); } }
  </style>
  <div id="wrap"><div id="q1">q1</div><div id="q2">q2</div></div>`,
  () => {
    const out = {};
    for (const id of ['q1', 'q2']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 10d. same on a size container (should match)
console.log('--- 10d. aspect-ratio/orientation on size container ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: size; width: 400px; height: 200px; }
    #q1 { color: black; } #q2 { color: black; }
    @container (aspect-ratio: 2/1) { #q1 { color: rgb(255, 0, 0); } }
    @container (orientation: landscape) { #q2 { color: rgb(0, 0, 255); } }
  </style>
  <div id="wrap"><div id="q1">q1</div><div id="q2">q2</div></div>`,
  () => {
    const out = {};
    for (const id of ['q1', 'q2']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 11. block-size declaration dropped: earlier valid declaration wins in cascade?
console.log('--- 11. container-type: block-size cascade recovery ---');
console.log(await evalHtml(
  `<style>
    #a { container-type: size; }
    #a { container-type: block-size; }
    #b { container-type: block-size; }
    #b { container-type: size; }
  </style><div id="a">a</div><div id="b">b</div>`,
  () => {
    const out = {};
    for (const id of ['a', 'b']) out[id] = getComputedStyle(document.getElementById(id)).containerType;
    return out;
  },
));

// 11b. does block-size establish a container under any circumstance? (explicit height + named query)
console.log('--- 11b. block-size container: named query + explicit size ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container: hero / block-size; width: 300px; height: 500px; }
    #q { color: black; }
    @container hero (min-height: 100px) { #q { color: rgb(255, 0, 0); } }
    @container hero (min-width: 100px) { #q { box-shadow: none; } }
  </style>
  <div id="wrap"><div id="q">q</div></div>`,
  () => {
    const out = {};
    out.color = getComputedStyle(document.getElementById('q')).color;
    out.wrapType = getComputedStyle(document.getElementById('wrap')).containerType;
    const r = document.getElementById('wrap').getBoundingClientRect();
    out.wrapRect = { w: r.width, h: r.height };
    return out;
  },
));

// 12. size containment: does the container still stretch to fill inline? (auto width)
// and does an inner block with margin collapse behave? (probing containment + zero height)
console.log('--- 12. size container auto width + margins ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #s { container-type: size; background: rgb(255, 0, 0); }
    #s2 { container-type: size; background: rgb(0, 0, 255); padding: 10px; }
  </style>
  <div id="s"><div style="height:40px;background:rgb(0,255,0)">x</div></div>
  <div id="s2"><div style="height:40px;background:rgb(0,255,0)">x</div></div>`,
  () => {
    const out = {};
    for (const id of ['s', 's2']) {
      const r = document.getElementById(id).getBoundingClientRect();
      out[id] = { w: r.width, h: r.height };
    }
    return out;
  },
));

// 13. inline-size container: does (width) exact match and does containment change auto width? (control for existing corpus)
console.log('--- 13. inline-size: range syntax + width exact (existing parity control) ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: inline-size; width: 400px; }
    #q1 { color: black; } #q2 { color: black; }
    @container (width > 300px) { #q1 { color: rgb(255, 0, 0); } }
    @container (width: 400px) { #q2 { color: rgb(0, 0, 255); } }
  </style>
  <div id="wrap"><div id="q1">q1</div><div id="q2">q2</div></div>`,
  () => {
    const out = {};
    for (const id of ['q1', 'q2']) out[id] = getComputedStyle(document.getElementById(id)).color;
    return out;
  },
));

// 14. cq units in font-size inside inline-size container (cqi) and used values
console.log('--- 14. cq units on inline-size container: cqw vs cqh fallback ---');
console.log(await evalHtml(
  `<style>
    body { margin: 0; }
    #wrap { container-type: inline-size; width: 400px; height: 300px; }
    #q { font-size: 5cqw; width: 10cqw; height: 10cqh; }
  </style>
  <div id="wrap"><div id="q">q</div></div>`,
  () => {
    const cs = getComputedStyle(document.getElementById('q'));
    return { fontSize: cs.fontSize, width: cs.width, height: cs.height };
  },
));

await browser.close();
