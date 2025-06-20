const { parse } = require('acorn');
const code = `function test({
  a = 1,
  b = { x: 1, y: 2 },
  ...rest
} = {}) {
  return { a, b, ...rest };
}`;

const ast = parse(code, {
  ecmaVersion: 'latest',
  sourceType: 'module'
});

console.log(JSON.stringify(ast, (key, value) => {
  // Filter out large arrays and source strings
  if (key === 'source' || key === 'comments') return undefined;
  if (Array.isArray(value) && value.length > 10) return `[Array(${value.length})]`;
  return value;
}, 2));
