import * as csstree from 'css-tree';

const sup = csstree.parse('@supports (display: flex) and not (color: red) or ((width: 1px) and (height: 2px)) { .a{} }');
const s = sup.children.toArray()[0];
const cond = s.prelude.children.toArray()[0];
console.log('supports condition:', JSON.stringify(cond, (k,v) => v && v.type === 'List' ? `[List ${v.size}]` : v, 0));
function walkCond(node, d) {
  console.log(' '.repeat(d*2) + node.type + (node.name ? ' name='+node.name : '') + (node.value ? ' value='+JSON.stringify(node.value) : ''));
  if (node.children) for (const c of node.children) walkCond(c, d+1);
}
walkCond(cond, 0);

const imp = csstree.parse('@import url("a.css") screen and (min-width: 100px);');
const i = imp.children.toArray()[0];
console.log('import children:', i.prelude.children.toArray().map(c => c.type).join(', '));
for (const c of i.prelude.children.toArray()) {
  console.log('  ', c.type, 'locType=', c.loc?.source ?? '');
  if (c.type === 'Url') console.log('    url value:', JSON.stringify(c.value));
  if (c.type === 'MediaQueryList') console.log('    mql:', csstree.generate(c));
  if (c.type === 'Raw') console.log('    raw:', JSON.stringify(c.value));
}

const badInputs = [
  'div { color: red; ',
  '@media { }',
  '}',
  'a{',
  'a{b:c}d{e:f}',
  '@import',
  '/* unterminated',
  'a { color red }',
];
for (const b of badInputs) {
  try {
    const ast = csstree.parse(b, { onParseError: (e) => {} });
    console.log('OK parsed:', JSON.stringify(b.slice(0,20)), '->', ast.type);
  } catch (e) {
    console.log('THREW:', JSON.stringify(b.slice(0,20)), '->', e.message);
  }
}

const mixed = `div { color: red; p { margin: 0 } } .x { width: 1px; }`;
const ast2 = csstree.parse(mixed);
for (const n of ast2.children.toArray()) {
  console.log('top:', n.type, n.type === 'Rule' ? 'prelude='+csstree.generate(n.prelude) : n.type === 'Atrule' ? '@'+n.name : '');
}
