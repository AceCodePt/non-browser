import { chromium } from 'playwright';

const cases = [
  {
    name: 'self-ref-with-fallback',
    html: `<style>#a{--a:var(--a, 5px)}#b{--x:var(--y,7px);--y:var(--x)}#c{--p:var(--q,9px);--q:var(--missing)}</style><div id="a">a</div><div id="b">b</div><div id="c">c</div>`,
    ids: ['a', 'b', 'c'],
  },
  {
    name: 'registered-var-invalid-computed',
    html: `<style>@property --reg {syntax:'<length>';inherits:true;initial-value:1px}#p{--reg:var(--missing)}</style><div id="p"><div id="child">x</div></div>`,
    ids: ['p', 'child'],
  },
  {
    name: 'registered-color-via-var',
    html: `<style>@property --col {syntax:'<color>';inherits:false;initial-value:black}#a{--col:var(--x);--x:blue}#b{--col:var(--nope,red)}</style><div id="a">a</div><div id="b">b</div>`,
    ids: ['a', 'b'],
  },
  {
    name: 'registered-length-serialization',
    html: `<style>@property --len {syntax:'<length>';inherits:false;initial-value:0px}#a{--len:5PX}#b{--len:calc(10px + 2px)}#c{--len:10.0px}#d{--len:var(--o);--o:7px}</style><div id="a">a</div><div id="b">b</div><div id="c">c</div><div id="d">d</div>`,
    ids: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'unregistered-ref-registered',
    html: `<style>@property --len {syntax:'<length>';inherits:false;initial-value:0px}#a{--u:var(--len);--len:5px}#b{--u:var(--len)}</style><div id="a">a</div><div id="b">b</div>`,
    ids: ['a', 'b'],
  },
  {
    name: 'case-sensitivity',
    html: `<style>#a{--Foo:1px;--foo:2px;--b:var(--FOO)}</style><div id="a">a</div>`,
    ids: ['a'],
  },
  {
    name: 'fallback-commas-and-multi',
    html: `<style>#a{--a:var(--nope, 1px solid red)}#b{--b:var(--nope, calc(1px + 2px))}#c{--c:var(--nope , 5px)}#d{--d:var(--nope, var(--x, 3px))}#e{--e:var(--nope, a, b)}</style><div id="a">a</div><div id="b">b</div><div id="c">c</div><div id="d">d</div><div id="e">e</div>`,
    ids: ['a', 'b', 'c', 'd', 'e'],
  },
  {
    name: 'inline-style',
    html: `<style>#a{--x:1px}</style><div id="a" style="--x:2px">a</div>`,
    ids: ['a'],
  },
  {
    name: 'registered-overrides-and-wins',
    html: `<style>@property --len {syntax:'<length>';inherits:true;initial-value:1px}#a{--len:5px;--len:bad;--len:7px}</style><div id="a">a</div>`,
    ids: ['a'],
  },
  {
    name: 'var-of-empty',
    html: `<style>#a{--x:;--a:var(--x)}#b{--y:var(--x, fallback)}</style><div id="a">a</div><div id="b">b</div>`,
    ids: ['a', 'b'],
  },
  {
    name: 'cycle-through-inherit',
    html: `<style>#p{--c:var(--d)}#c{--d:var(--c)}</style><div id="p"><div id="c">x</div></div>`,
    ids: ['p', 'c'],
  },
  {
    name: 'declared-empty-inheritance',
    html: `<style>#p{--x:10px}</style><div id="p"><div id="c" style="--x:">x</div></div>`,
    ids: ['p', 'c'],
  },
];

const b = await chromium.launch();
const p = await b.newPage();
for (const c of cases) {
  await p.setContent(c.html);
  const out = await p.evaluate((ids) => {
    const res = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      const cs = getComputedStyle(el);
      const obj = {};
      for (const name of cs) {
        if (name.startsWith('--')) obj[name] = cs.getPropertyValue(name);
      }
      res[id] = obj;
    }
    return res;
  }, c.ids);
  console.log('=== ' + c.name);
  console.log(JSON.stringify(out));
}
await b.close();
