import * as csstree from 'css-tree';

const css = `
/* comment */
@import url("a.css") screen;
@import 'b.css';
@font-face { font-family: "Foo"; src: url(foo.woff2); }
@supports (display: flex) { .a { color: red; } }
@supports (display: run-in) { .b { color: blue; } }
@supports not (display: grid) { .c { color: green; } }
@media (min-width: 600px) { .m { width: 5px; } }
@container (min-width: 100px) { .ct { color: pink; } }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.x { color: red; color: this-is-bad; font-size: 12px; }
bad rule { color: red; }
.baddecl { color }
.y { margin: 0; }
@import url("c.css");
.after { display: block; }
`;

const ast = csstree.parse(css, { positions: true, onParseError: (e) => console.log('PARSE ERROR:', e.message) });
console.log('ast.type:', ast.type);
function walk(node, depth) {
  const pad = '  '.repeat(depth);
  if (node.type === 'Raw') {
    console.log(`${pad}Raw: ${JSON.stringify(node.value.slice(0, 40))}`);
    return;
  }
  if (node.type === 'Atrule') {
    const prelude = node.prelude ? csstree.generate(node.prelude) : null;
    console.log(`${pad}Atrule @${node.name} prelude=${JSON.stringify(prelude)} hasBlock=${!!node.block}`);
    if (node.block && node.block.type === 'Block') {
      for (const c of node.block.children.toArray()) walk(c, depth + 1);
    }
    return;
  }
  if (node.type === 'Rule') {
    const prelude = node.prelude ? csstree.generate(node.prelude) : null;
    console.log(`${pad}Rule prelude=${JSON.stringify(prelude)}`);
    if (node.block && node.block.type === 'Block') {
      for (const c of node.block.children.toArray()) walk(c, depth + 1);
    }
    return;
  }
  if (node.type === 'Declaration') {
    console.log(`${pad}Declaration ${node.property}: ${node.value ? csstree.generate(node.value) : '?'} important=${!!node.important}`);
    return;
  }
  if (node.type === 'Raw') { console.log(`${pad}Raw: ${JSON.stringify(node.value)}`); return; }
  console.log(`${pad}${node.type}: ${JSON.stringify(node).slice(0, 120)}`);
}
for (const c of ast.children.toArray()) walk(c, 0);
