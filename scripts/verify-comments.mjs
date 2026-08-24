#!/usr/bin/env node
/**
 * `npm run verify:comments`
 *
 * Regression gate for HTML comment nodes. `resolveStyles` used to call
 * `el.attrs.find(...)` on every non-text child, but comment nodes (`#comment`,
 * emitted by parse5 for `<!-- ... -->`) carry no `attrs`, so any document that
 * contained a comment threw `TypeError: Cannot read properties of undefined
 * (reading 'find')` before layout even began. Comments are ubiquitous in real
 * HTML (conditional comments, build banners, framework markers), so this made
 * the engine crash on ordinary input.
 *
 * This test asserts two properties, using the repo-bundled font so it needs no
 * system fonts and no browser oracle:
 *   1. Documents containing comments in every structural position render
 *      without throwing.
 *   2. Comments are layout-invisible: the rects of a document are byte-identical
 *      whether or not comments are interleaved into the same markup.
 */

import assert from 'node:assert/strict';
import { render as renderAt, errorMessage } from './lib/render.mjs';

/** @param {string} body @param {string} [style] */
const render = (body, style = '') => renderAt(body, { width: 400, height: 300, style });

// Each case: [name, withoutComments, withComments, style]. The two markups must
// lay out identically — the only difference is interleaved comment nodes.
const cases = [
  ['between blocks',
    `<div id="a" style="height:20px">a</div><div id="b" style="height:20px">b</div>`,
    `<div id="a" style="height:20px">a</div><!-- gap --><div id="b" style="height:20px">b</div>`],
  ['inline mid-text',
    `<p id="a">hello world</p>`,
    `<p id="a">hello <!-- c --> world</p>`],
  ['inside inline span',
    `<p id="a"><span>ab</span></p>`,
    `<p id="a"><span>a<!-- c -->b</span></p>`],
  ['flex children',
    `<div id="a" style="display:flex"><div id="b" style="flex:1">x</div><div id="c" style="flex:1">y</div></div>`,
    `<div id="a" style="display:flex"><!--h--><div id="b" style="flex:1">x</div><!--m--><div id="c" style="flex:1">y</div><!--t--></div>`],
  ['grid children',
    `<div id="a" style="display:grid;grid-template-columns:1fr 1fr"><div id="b">x</div><div id="c">y</div></div>`,
    `<div id="a" style="display:grid;grid-template-columns:1fr 1fr"><div id="b">x</div><!--c--><div id="c">y</div></div>`],
  ['float sibling',
    `<div id="a" style="float:left;width:40px;height:40px">x</div><div id="b">y</div>`,
    `<div id="a" style="float:left;width:40px;height:40px">x</div><!--c--><div id="b">y</div>`],
  ['list item',
    `<ul><li id="a">x</li></ul>`,
    `<ul><!--c--><li id="a"><!--d-->x</li></ul>`],
  ['leading comment + conditional',
    `<div id="a"><p id="b">ok</p></div>`,
    `<div id="a"><!--[if IE]>legacy<![endif]--><!--x--><p id="b">ok</p></div>`],
];

let pass = 0;
/** @type {string[]} */
const fails = [];

// Property 1 + 2 over the matrix.
for (const [name, plain, commented, style] of cases) {
  let base, withc;
  try {
    base = render(plain, style);
    withc = render(commented, style);
  } catch (e) {
    fails.push(`${name}: threw ${errorMessage(e)}`);
    continue;
  }
  try {
    assert.deepEqual(withc.rects, base.rects, 'comments changed layout');
    pass++;
  } catch {
    fails.push(`${name}: rects differ with vs without comments\n    without: ${JSON.stringify(base.rects)}\n    with:    ${JSON.stringify(withc.rects)}`);
  }
}

// Property: the exact original crash repro renders.
try {
  render(`<!-- a comment --><p id="a">hi</p>`);
  pass++;
} catch (e) {
  fails.push(`original repro still throws: ${errorMessage(e)}`);
}

const total = cases.length + 1;
for (const f of fails) console.log(`FAIL ${f}`);
console.log(`${pass}/${total} comment checks passed`);
if (fails.length) {
  console.error('verify:comments: FAIL');
  process.exit(1);
}
console.log('verify:comments: PASS');
