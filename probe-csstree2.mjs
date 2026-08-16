import * as csstree from 'css-tree';

const ast = csstree.parse('@supports (display: flex) and not (color: red) { .a{} } @media screen and (min-width: 100px) { .b{} } @import url("x.css");');
for (const n of ast.children.toArray()) {
  if (n.type === 'Atrule') {
    console.log('atrule', n.name, 'prelude type:', n.prelude?.type);
    if (n.prelude) console.log('  children:', n.prelude.children ? n.prelude.children.toArray().map(c => c.type).join(',') : 'n/a');
    if (n.prelude?.type === 'Raw') console.log('  raw:', JSON.stringify(n.prelude.value));
    if (n.prelude?.type === 'MediaQueryList') console.log('  mql:', JSON.stringify(n.prelude.children.toArray().map(q => csstree.generate(q))));
  }
}

const checks = [
  ['color', 'red'], ['color', 'this-is-bad'], ['color', '12px'],
  ['display', 'flex'], ['display', 'banana'], ['display', 'ruby'],
  ['width', '100px'], ['width', 'banana'],
  ['font-family', '"Foo"'], ['margin', '0 auto'],
  ['background', 'red url(foo.png)'], ['grid-template-columns', 'repeat(2, 1fr)'],
  ['-webkit-box-reflect', 'below'], ['xyz-prop', '1px'],
];
for (const [prop, value] of checks) {
  const res = csstree.lexer.matchProperty(prop, value);
  console.log(`matchProperty(${prop}, ${JSON.stringify(value)}) matched=${res.matched ? 'Y' : 'N'} err=${res.error ? res.error.message.slice(0,60) : ''}`);
}
