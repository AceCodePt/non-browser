import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
const alphas = [];
for (let a = 0; a <= 100; a++) alphas.push((a/100).toFixed(2));
const style = alphas.map((a, i) => `#e${i}{color:rgba(0, 0, 255, ${a})}`).join('');
const divs = alphas.map((_, i) => `<div id="e${i}"></div>`).join('');
await p.setContent(`<style>${style}</style>${divs}`);
const out = await p.evaluate(([alphas]) => {
  const res = {};
  alphas.forEach((a, i) => { res[a] = getComputedStyle(document.getElementById('e' + i)).color.replace('rgb(0, 0, 255)', '').replace('rgba(0, 0, 255, ', '').replace(')', '').replace('rgb', '').replace('rgba', ''); });
  return res;
}, [alphas]);
console.log(JSON.stringify(out));
await b.close();
