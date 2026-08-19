#!/usr/bin/env node
/**
 * `npm run verify:float-content`
 *
 * A float used to lay out only its inline content: `layoutFloat` walked text
 * lines and set `children: []`, so block-level or floated descendants of a
 * float were dropped. Because the engine asserts rect-completeness (every
 * id-bearing element must get a rect), any float containing a block/floated
 * child with an id crashed the whole render ("no rect collected for id(s)").
 * This is common real markup (a floated card/sidebar with block content, the
 * Acid1 shape of floated list items inside a floated container).
 *
 * This gate asserts such documents render, and that the inner block/float
 * children get sensible rects inside the float. Uses the repo-bundled font, no
 * browser oracle.
 */
import assert from 'node:assert/strict';
import { render, errorMessage } from './lib/render.mjs';

/** @param {string} body */
const at = (body) => render(body, { width: 400, height: 300 });

let pass = 0;
/** @type {string[]} */
const fails = [];
/** @param {string} name @param {() => void} fn */
const check = (name, fn) => { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${errorMessage(e)}`); } };

// 1. Block child of a float gets a rect inside the float.
check('block child of float', () => {
  const r = at(`<div style="float:left;width:100px;padding:10px"><div id="inner" style="height:20px">x</div></div>`).rects;
  assert.ok(r.inner, 'inner block has no rect');
  assert.equal(r.inner.x, 10, 'inner x should sit at float padding');
  assert.equal(r.inner.width, 100, 'inner block fills float content width');
});

// 2. Float nested inside a float gets a rect (the original crash / Acid1 shape).
check('float nested in float', () => {
  const r = at(`<div style="float:right;width:120px"><div id="nf" style="float:left;width:20px;height:20px">b</div></div>`).rects;
  assert.ok(r.nf, 'nested float has no rect');
  assert.equal(r.nf.width, 20);
});

// 3. Floated list items inside a floated container (Acid1-like) all render.
check('floated list items in floated container', () => {
  const r = at(`<div style="float:right;width:200px"><ul style="margin:0;padding:0"><li id="a" style="float:left;width:40px;height:20px">a</li><li id="b" style="float:left;width:40px;height:20px">b</li></ul></div>`).rects;
  assert.ok(r.a && r.b, 'floated list items missing rects');
});

// 4. Inline-only floats are unchanged (no regression to the existing path).
check('inline float still works', () => {
  const r = at(`<div id="f" style="float:left;width:80px;height:30px">hello</div>`).rects;
  assert.ok(r.f && r.f.width === 80 && r.f.height === 30, 'inline float rect changed');
});

for (const f of fails) console.log(`FAIL ${f}`);
console.log(`${pass}/${pass + fails.length} float-content checks passed`);
if (fails.length) { console.error('verify:float-content: FAIL'); process.exit(1); }
console.log('verify:float-content: PASS');
